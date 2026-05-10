import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { staffUsers } from "@/lib/db/schema";

export interface StaffUserRecord {
  id: string;
  schoolId: string;
  role: "editor" | "admin";
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
      email: staffUsers.email,
      fullName: staffUsers.fullName,
    })
    .from(staffUsers)
    .where(eq(staffUsers.id, authId))
    .limit(1);

  if (!row) return null;
  return row as StaffUserRecord;
}
