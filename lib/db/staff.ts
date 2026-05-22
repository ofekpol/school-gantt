import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, withSchool } from "@/lib/db/client";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { editorScopes, schools, staffUsers } from "@/lib/db/schema";

export interface StaffUserRecord {
  id: string;
  schoolId: string | null;
  schoolSlug?: string | null;
  role: "editor" | "admin" | "viewer";
  status: "pending" | "active" | "deactivated";
  email: string;
  fullName: string;
  mustChangePassword: boolean;
}

/**
 * Looks up a staff_users row by Supabase auth.users.id (which equals staff_users.id by FK).
 *
 * This lookup uses the service-role `db` connection because we do not yet know `schoolId`
 * and therefore cannot call `withSchool()`. The query is by primary key, so the cross-school
 * surface area is minimal — the caller still must pass `schoolId` into `withSchool` for any
 * subsequent school-scoped query.
 *
 * Lives in `lib/db/` so the ESLint rule banning supabaseAdmin / raw service-role queries
 * outside `lib/db/` is preserved (CLAUDE.md "Multi-Tenancy (Critical)").
 */
export async function getStaffUserByAuthId(authId: string): Promise<StaffUserRecord | null> {
  const [row] = await db
    .select({
      id: staffUsers.id,
      schoolId: staffUsers.schoolId,
      schoolSlug: schools.slug,
      role: staffUsers.role,
      status: staffUsers.status,
      email: staffUsers.email,
      fullName: staffUsers.fullName,
      mustChangePassword: staffUsers.mustChangePassword,
    })
    .from(staffUsers)
    .leftJoin(schools, eq(staffUsers.schoolId, schools.id))
    .where(eq(staffUsers.id, authId))
    .limit(1);

  if (!row) return null;
  return row as StaffUserRecord;
}

export async function createStaffUserFromInvite(params: {
  authUserId: string;
  schoolId: string;
  email: string;
  fullName: string;
  role: "editor" | "admin" | "viewer";
  gradeScopes?: number[];
  eventTypeScopes?: string[];
}): Promise<{ id: string }> {
  await withSchool(params.schoolId, async (tx) => {
    await tx.insert(staffUsers).values({
      id: params.authUserId,
      schoolId: params.schoolId,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
      status: "active",
    });

    const scopeRows: Array<{
      staffUserId: string;
      schoolId: string;
      scopeKind: "grade" | "event_type";
      scopeValue: string;
    }> = [
      ...(params.gradeScopes ?? []).map((g) => ({
        staffUserId: params.authUserId,
        schoolId: params.schoolId,
        scopeKind: "grade" as const,
        scopeValue: String(g),
      })),
      ...(params.eventTypeScopes ?? []).map((k) => ({
        staffUserId: params.authUserId,
        schoolId: params.schoolId,
        scopeKind: "event_type" as const,
        scopeValue: k,
      })),
    ];

    if (scopeRows.length > 0) {
      await tx.insert(editorScopes).values(scopeRows);
    }
  });

  return { id: params.authUserId };
}

/**
 * Creates a staff_users row for a user who registered via email/password.
 * schoolId is null — an admin assigns the school later.
 * Called from /auth/confirm after Supabase verifies the signup OTP.
 * Idempotent: onConflictDoNothing prevents duplicate-key errors on retry.
 */
export async function createStaffUserFromEmailSignup(params: {
  authUserId: string;
  email: string;
  fullName: string;
}): Promise<void> {
  await db
    .insert(staffUsers)
    .values({
      id: params.authUserId,
      schoolId: null,
      email: params.email,
      fullName: params.fullName,
      role: "editor",
      status: "active",
    })
    .onConflictDoNothing();
}

/**
 * Updates a staff user's fields.
 * If deactivated=true, sets deactivated_at and revokes all sessions via supabaseAdmin.
 */
export async function updateStaffUser(
  schoolId: string,
  staffUserId: string,
  fields: {
    fullName?: string;
    role?: "editor" | "admin" | "viewer";
    deactivated?: boolean;
    gradeScopes?: number[];
    eventTypeScopes?: string[];
  },
): Promise<void> {
  await withSchool(schoolId, async (tx) => {
    const updates: Partial<{
      fullName: string;
      role: "editor" | "admin" | "viewer";
      status: "pending" | "active" | "deactivated";
      deactivatedAt: Date | null;
    }> = {};
    if (fields.fullName !== undefined) updates.fullName = fields.fullName;
    if (fields.role !== undefined) updates.role = fields.role;
    if (fields.deactivated) {
      updates.deactivatedAt = new Date();
      updates.status = "deactivated";
    } else if (fields.deactivated === false) {
      updates.deactivatedAt = null;
      updates.status = "active";
    }

    if (Object.keys(updates).length > 0) {
      await tx.update(staffUsers).set(updates).where(eq(staffUsers.id, staffUserId));
    }

    const shouldRewriteScopes =
      fields.gradeScopes !== undefined ||
      fields.eventTypeScopes !== undefined ||
      fields.role === "admin" ||
      fields.role === "viewer";

    if (shouldRewriteScopes) {
      await tx.delete(editorScopes).where(eq(editorScopes.staffUserId, staffUserId));

      if (fields.role === undefined || fields.role === "editor") {
        const gradeRows = (fields.gradeScopes ?? []).map((g) => ({
          staffUserId,
          schoolId,
          scopeKind: "grade" as const,
          scopeValue: String(g),
        }));
        const etRows = (fields.eventTypeScopes ?? []).map((k) => ({
          staffUserId,
          schoolId,
          scopeKind: "event_type" as const,
          scopeValue: k,
        }));
        const all = [...gradeRows, ...etRows];
        if (all.length > 0) await tx.insert(editorScopes).values(all);
      }
    }
  });

  if (fields.deactivated) {
    await supabaseAdmin.auth.admin.signOut(staffUserId, "global");
  }
}

export async function getStaffUserByEmail(
  email: string,
): Promise<{ id: string; status: "pending" | "active" | "deactivated"; loginAttempts: number; lockedUntil: Date | null } | null> {
  const [row] = await db
    .select({
      id: staffUsers.id,
      status: staffUsers.status,
      loginAttempts: staffUsers.loginAttempts,
      lockedUntil: staffUsers.lockedUntil,
    })
    .from(staffUsers)
    .where(eq(staffUsers.email, email))
    .limit(1);
  return row ?? null;
}

export async function incrementLoginAttempts(
  staffUserId: string,
  currentAttempts: number,
): Promise<void> {
  const newAttempts = currentAttempts + 1;
  const lockedUntil =
    newAttempts >= 10 ? new Date(Date.now() + 15 * 60 * 1000) : null;

  await db
    .update(staffUsers)
    .set({
      loginAttempts: newAttempts,
      lockedUntil,
    })
    .where(eq(staffUsers.id, staffUserId));
}

export async function resetLoginAttempts(staffUserId: string): Promise<void> {
  await db
    .update(staffUsers)
    .set({ loginAttempts: 0, lockedUntil: null })
    .where(eq(staffUsers.id, staffUserId));
}

/**
 * Lists all staff users for a school, ordered by creation date.
 * Uses withSchool so RLS filters to the correct school.
 */
export async function listStaffUsers(
  schoolId: string,
): Promise<
  Array<{
    id: string;
    email: string;
    fullName: string;
    role: "editor" | "admin" | "viewer";
    deactivatedAt: Date | null;
    status: "pending" | "active" | "deactivated";
    gradeScopes: number[];
    eventTypeScopes: string[];
  }>
> {
  return withSchool(schoolId, async (tx) => {
    const rows = await tx
      .select({
        id: staffUsers.id,
        email: staffUsers.email,
        fullName: staffUsers.fullName,
        role: staffUsers.role,
        deactivatedAt: staffUsers.deactivatedAt,
        status: staffUsers.status,
      })
      .from(staffUsers);

    if (rows.length === 0) return [];

    const scopes = await tx
      .select({
        staffUserId: editorScopes.staffUserId,
        scopeKind: editorScopes.scopeKind,
        scopeValue: editorScopes.scopeValue,
      })
      .from(editorScopes)
      .where(
        inArray(
          editorScopes.staffUserId,
          rows.map((row) => row.id),
        ),
      );

    const scopesByStaff = new Map<string, { gradeScopes: number[]; eventTypeScopes: string[] }>();
    for (const row of rows) {
      scopesByStaff.set(row.id, { gradeScopes: [], eventTypeScopes: [] });
    }
    for (const scope of scopes) {
      const target = scopesByStaff.get(scope.staffUserId);
      if (!target) continue;
      if (scope.scopeKind === "grade") target.gradeScopes.push(Number(scope.scopeValue));
      if (scope.scopeKind === "event_type") target.eventTypeScopes.push(scope.scopeValue);
    }

    return rows.map((row) => ({
      ...row,
      gradeScopes: scopesByStaff.get(row.id)?.gradeScopes.sort((a, b) => a - b) ?? [],
      eventTypeScopes: scopesByStaff.get(row.id)?.eventTypeScopes.sort() ?? [],
    }));
  });
}
