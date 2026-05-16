import "server-only";
import { eq } from "drizzle-orm";
import { db, withSchool } from "@/lib/db/client";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { editorScopes, staffUsers } from "@/lib/db/schema";

export interface StaffUserRecord {
  id: string;
  schoolId: string;
  role: "editor" | "admin" | "viewer";
  status: "pending" | "active" | "deactivated";
  email: string;
  fullName: string;
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
      role: staffUsers.role,
      status: staffUsers.status,
      email: staffUsers.email,
      fullName: staffUsers.fullName,
    })
    .from(staffUsers)
    .where(eq(staffUsers.id, authId))
    .limit(1);

  if (!row) return null;
  return row;
}

/**
 * Creates a new staff user by:
 * 1. Calling supabaseAdmin.auth.admin.createUser to register the auth user.
 * 2. Inserting a staff_users row with the returned auth.users.id.
 * 3. Inserting editor_scopes rows for any grade or event-type scopes provided.
 *
 * The auth user id equals staff_users.id (FK convention from Phase 1 schema).
 */
export async function createStaffUser(params: {
  schoolId: string;
  email: string;
  fullName: string;
  role: "editor" | "admin" | "viewer";
  temporaryPassword: string;
  gradeScopes?: number[];
  eventTypeScopes?: string[];
}): Promise<{ id: string }> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password: params.temporaryPassword,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "auth_create_failed");
  }
  const authId = data.user.id;

  await withSchool(params.schoolId, async (tx) => {
    await tx.insert(staffUsers).values({
      id: authId,
      schoolId: params.schoolId,
      email: params.email,
      fullName: params.fullName,
      role: params.role,
    });
    const scopeRows: Array<{
      staffUserId: string;
      schoolId: string;
      scopeKind: "grade" | "event_type";
      scopeValue: string;
    }> = [
      ...(params.gradeScopes ?? []).map((g) => ({
        staffUserId: authId,
        schoolId: params.schoolId,
        scopeKind: "grade" as const,
        scopeValue: String(g),
      })),
      ...(params.eventTypeScopes ?? []).map((k) => ({
        staffUserId: authId,
        schoolId: params.schoolId,
        scopeKind: "event_type" as const,
        scopeValue: k,
      })),
    ];
    if (scopeRows.length > 0) {
      await tx.insert(editorScopes).values(scopeRows);
    }
  });

  return { id: authId };
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
      deactivatedAt: Date;
    }> = {};
    if (fields.fullName !== undefined) updates.fullName = fields.fullName;
    if (fields.role !== undefined) updates.role = fields.role;
    if (fields.deactivated) updates.deactivatedAt = new Date();

    if (Object.keys(updates).length > 0) {
      await tx.update(staffUsers).set(updates).where(eq(staffUsers.id, staffUserId));
    }

    if (fields.gradeScopes !== undefined || fields.eventTypeScopes !== undefined) {
      if (fields.gradeScopes !== undefined) {
        await tx
          .delete(editorScopes)
          .where(
            eq(editorScopes.staffUserId, staffUserId),
          );
        const gradeRows = fields.gradeScopes.map((g) => ({
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
        if (all.length > 0) {
          await tx.insert(editorScopes).values(all);
        }
      }
    }
  });

  if (fields.deactivated) {
    await supabaseAdmin.auth.admin.signOut(staffUserId, "global");
  }
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
  }>
> {
  const rows = await withSchool(schoolId, (tx) =>
    tx
      .select({
        id: staffUsers.id,
        email: staffUsers.email,
        fullName: staffUsers.fullName,
        role: staffUsers.role,
        deactivatedAt: staffUsers.deactivatedAt,
      })
      .from(staffUsers),
  );
  return rows;
}
