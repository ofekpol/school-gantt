import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, supabaseAdmin, withSchool } from "./client";
import * as schema from "./schema";

/**
 * Default per-school event types — same 11 categories used in db/seed.ts.
 * Color-blind-safe palette + distinct glyphs. Admin can edit via /admin/event-types after launch.
 */
export const DEFAULT_EVENT_TYPES = [
  { key: "trip", labelHe: "טיול", labelEn: "Trip", colorHex: "#1f77b4", glyph: "T", sortOrder: 1 },
  { key: "exam", labelHe: "מבחן", labelEn: "Exam", colorHex: "#d62728", glyph: "E", sortOrder: 2 },
  { key: "ceremony", labelHe: "טקס", labelEn: "Ceremony", colorHex: "#9467bd", glyph: "C", sortOrder: 3 },
  { key: "vacation", labelHe: "חופשה", labelEn: "Vacation", colorHex: "#2ca02c", glyph: "V", sortOrder: 4 },
  { key: "parent_meeting", labelHe: "אסיפת הורים", labelEn: "Parent Meeting", colorHex: "#ff7f0e", glyph: "P", sortOrder: 5 },
  { key: "counseling", labelHe: "ייעוץ", labelEn: "Counseling", colorHex: "#8c564b", glyph: "S", sortOrder: 6 },
  { key: "lecture", labelHe: "הרצאה", labelEn: "Lecture", colorHex: "#17becf", glyph: "L", sortOrder: 7 },
  { key: "workshop", labelHe: "סדנה", labelEn: "Workshop", colorHex: "#bcbd22", glyph: "W", sortOrder: 8 },
  { key: "sport", labelHe: "ספורט", labelEn: "Sport", colorHex: "#e377c2", glyph: "X", sortOrder: 9 },
  { key: "holiday", labelHe: "חג", labelEn: "Holiday", colorHex: "#7f7f7f", glyph: "H", sortOrder: 10 },
  { key: "general", labelHe: "כללי", labelEn: "General", colorHex: "#aec7e8", glyph: "G", sortOrder: 11 },
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const ProvisionSchoolInput = z
  .object({
    slug: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/, "slug must match ^[a-z0-9-]+$"),
    name: z.string().min(1).max(200),
    locale: z.enum(["he", "en"]).default("he"),
    timezone: z.string().default("Asia/Jerusalem"),
    yearLabel: z.string().min(1).max(64),
    yearStart: isoDate,
    yearEnd: isoDate,
    adminEmail: z.string().email().max(255),
    adminName: z.string().min(1).max(200),
  })
  .refine((v) => v.yearStart < v.yearEnd, {
    message: "yearStart must be before yearEnd",
    path: ["yearEnd"],
  });

export type ProvisionSchoolInput = z.infer<typeof ProvisionSchoolInput>;

export interface ProvisionSchoolResult {
  schoolId: string;
  academicYearId: string;
  adminAuthUserId: string;
  magicLinkUrl: string;
  /** ISO 8601. Supabase magic links default to 1 hour. */
  magicLinkExpiresAt: string;
}

/**
 * Resolve a Supabase Auth user by email; create if absent.
 * No password set — admin authenticates via magic link only.
 */
async function ensureAuthUserPasswordless(email: string): Promise<string> {
  // listUsers is paginated; 200/page is enough for small prod projects.
  const { data: existing, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);
  const found = existing.users.find((u) => u.email === email);
  if (found) return found.id;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser ${email}: ${error?.message ?? "unknown"}`);
  }
  return data.user.id;
}

/**
 * Provision a brand-new tenant: school row + academic year + 11 event types + admin staff user.
 * Idempotency: conflicts on slug throw — we never clobber an existing school.
 * Caller is responsible for emailing the returned magicLinkUrl to the admin.
 */
export async function provisionSchool(
  rawInput: ProvisionSchoolInput,
): Promise<ProvisionSchoolResult> {
  const input = ProvisionSchoolInput.parse(rawInput);

  // 1. School row (no RLS on schools table — insert directly via db).
  // ON CONFLICT DO NOTHING + RETURNING returns no rows when conflict, so we detect duplicates.
  const inserted = await db
    .insert(schema.schools)
    .values({
      slug: input.slug,
      name: input.name,
      locale: input.locale,
      timezone: input.timezone,
    })
    .onConflictDoNothing({ target: schema.schools.slug })
    .returning({ id: schema.schools.id });

  if (inserted.length === 0) {
    throw new Error(`school with slug "${input.slug}" already exists — refusing to clobber`);
  }
  const schoolId = inserted[0].id;

  // 2-4. School-scoped data inside withSchool (RLS-enforced).
  const { academicYearId, adminAuthUserId } = await withSchool(schoolId, async (tx) => {
    // 2. Academic year
    const [year] = await tx
      .insert(schema.academicYears)
      .values({
        schoolId,
        label: input.yearLabel,
        startDate: input.yearStart,
        endDate: input.yearEnd,
      })
      .returning({ id: schema.academicYears.id });

    // 3. Default event types (11 rows)
    for (const et of DEFAULT_EVENT_TYPES) {
      await tx.insert(schema.eventTypes).values({ schoolId, ...et });
    }

    // 4. Admin staff user — Supabase Auth + staff_users row keyed by authUserId
    const authUserId = await ensureAuthUserPasswordless(input.adminEmail);
    await tx.insert(schema.staffUsers).values({
      id: authUserId,
      schoolId,
      email: input.adminEmail,
      fullName: input.adminName,
      role: "admin",
      status: "active",
      mustChangePassword: false,
    });

    return { academicYearId: year.id, adminAuthUserId: authUserId };
  });

  // 5. Set active academic year (schools has no RLS so update outside withSchool).
  await db.execute(
    sql`UPDATE schools SET active_academic_year_id = ${academicYearId} WHERE id = ${schoolId}`,
  );

  // 6. Generate magic link (1h default expiry) for admin first sign-in.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required to build the magic-link redirect");
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: input.adminEmail,
    options: { redirectTo: `${appUrl.replace(/\/$/, "")}/dashboard` },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    throw new Error(`generateLink: ${linkErr?.message ?? "no action_link returned"}`);
  }
  const magicLinkUrl = linkData.properties.action_link;
  // Supabase magic-link default OTP TTL is 3600s; reflect that in the result for the email body.
  const magicLinkExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  return {
    schoolId,
    academicYearId,
    adminAuthUserId,
    magicLinkUrl,
    magicLinkExpiresAt,
  };
}
