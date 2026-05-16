import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, supabaseAdmin, withSchool } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

const SCHOOL_SLUG = "demo-school";
const ADMIN_EMAIL = "admin@demo-school.test";

// 6 grade-supervisor editors (grades 7-12)
const GRADE_EDITORS = [
  { grade: 7, email: "grade7@demo-school.test", fullName: "Grade 7 Coordinator" },
  { grade: 8, email: "grade8@demo-school.test", fullName: "Grade 8 Coordinator" },
  { grade: 9, email: "grade9@demo-school.test", fullName: "Grade 9 Coordinator" },
  { grade: 10, email: "grade10@demo-school.test", fullName: "Grade 10 Coordinator" },
  { grade: 11, email: "grade11@demo-school.test", fullName: "Grade 11 Coordinator" },
  { grade: 12, email: "grade12@demo-school.test", fullName: "Grade 12 Coordinator" },
];
const COUNSELOR = {
  eventTypeKey: "counseling",
  email: "counselor@demo-school.test",
  fullName: "School Counselor",
};

// 11 default event types (color-blind safe glyphs, distinct colors)
const EVENT_TYPES = [
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
];

async function ensureAuthUser(email: string): Promise<string> {
  // listUsers paginated; sufficient for small seed.
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error ?? !data.user) throw new Error(`createUser ${email}: ${error?.message ?? "unknown"}`);
  return data.user.id;
}

async function main() {
  // 1. School — no RLS on schools table; insert directly
  const [school] = await db
    .insert(schema.schools)
    .values({
      slug: SCHOOL_SLUG,
      name: "Demo School",
      locale: "he",
      timezone: "Asia/Jerusalem",
    })
    .onConflictDoUpdate({
      target: schema.schools.slug,
      set: { name: sql`excluded.name` },
    })
    .returning();

  // 2. Academic year (current year, Sept 1 → next July 31)
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  // 3–7. All school-scoped data uses withSchool so RLS FORCE is satisfied
  await withSchool(school.id, async (tx) => {
    // 2. Academic year
    await tx
      .insert(schema.academicYears)
      .values({
        schoolId: school.id,
        label: `${startYear}-${startYear + 1}`,
        startDate: `${startYear}-09-01`,
        endDate: `${startYear + 1}-07-31`,
      })
      .onConflictDoNothing();

    // 3. Event types (insert before scopes so counselor scope FK-by-key works)
    for (const et of EVENT_TYPES) {
      await tx
        .insert(schema.eventTypes)
        .values({ schoolId: school.id, ...et })
        .onConflictDoUpdate({
          target: [schema.eventTypes.schoolId, schema.eventTypes.key],
          set: {
            labelHe: sql`excluded.label_he`,
            labelEn: sql`excluded.label_en`,
            colorHex: sql`excluded.color_hex`,
            glyph: sql`excluded.glyph`,
            sortOrder: sql`excluded.sort_order`,
          },
        });
    }

    // 4. Admin auth user (outside tx — Supabase Auth is a separate system)
    const adminAuthId = await ensureAuthUser(ADMIN_EMAIL);
    await tx
      .insert(schema.staffUsers)
      .values({
        id: adminAuthId,
        schoolId: school.id,
        email: ADMIN_EMAIL,
        fullName: "Demo Admin",
        role: "admin",
      })
      .onConflictDoUpdate({
        target: schema.staffUsers.email,
        set: { schoolId: school.id, role: "admin" },
      });

    // 5. Grade editors + scopes
    for (const ge of GRADE_EDITORS) {
      const authId = await ensureAuthUser(ge.email);
      await tx
        .insert(schema.staffUsers)
        .values({
          id: authId,
          schoolId: school.id,
          email: ge.email,
          fullName: ge.fullName,
          role: "editor",
        })
        .onConflictDoUpdate({
          target: schema.staffUsers.email,
          set: { schoolId: school.id, fullName: sql`excluded.full_name` },
        });
      await tx
        .insert(schema.editorScopes)
        .values({
          staffUserId: authId,
          schoolId: school.id,
          scopeKind: "grade",
          scopeValue: String(ge.grade),
        })
        .onConflictDoNothing();
    }

    // 6. Counselor + event_type scope
    const counselorAuthId = await ensureAuthUser(COUNSELOR.email);
    await tx
      .insert(schema.staffUsers)
      .values({
        id: counselorAuthId,
        schoolId: school.id,
        email: COUNSELOR.email,
        fullName: COUNSELOR.fullName,
        role: "editor",
      })
      .onConflictDoUpdate({
        target: schema.staffUsers.email,
        set: { schoolId: school.id, fullName: sql`excluded.full_name` },
      });

    await tx
      .insert(schema.editorScopes)
      .values({
        staffUserId: counselorAuthId,
        schoolId: school.id,
        scopeKind: "event_type",
        scopeValue: COUNSELOR.eventTypeKey,
      })
      .onConflictDoNothing();
  });

  console.log(`Seed complete: school=${school.slug} admin=${ADMIN_EMAIL}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
