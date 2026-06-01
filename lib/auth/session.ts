import "server-only";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffUserByAuthId, getStaffUserRecordByEmail, type StaffUserRecord } from "@/lib/db/staff";

/**
 * Returns the authenticated Supabase auth user or null.
 * Uses getUser() (validates JWT against Supabase Auth server) — NEVER getSession()
 * which only reads the cookie locally (Pitfall 2 — research RESEARCH.md line 557).
 */
export async function getSession(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

export type { StaffUserRecord };

/**
 * Resolves the authenticated user's staff_users row. Returns null if no auth or no matching row.
 * Delegates the DB lookup to `lib/db/staff.ts` so this file does not import the service-role
 * client directly (CLAUDE.md: the service-role client must only be imported inside `lib/db/`).
 */
export async function getStaffUser(): Promise<StaffUserRecord | null> {
  const authUser = await getSession();
  if (!authUser) return null;
  const byId = await getStaffUserByAuthId(authUser.id);
  if (byId) return byId;
  // Fallback: look up by email. Handles the case where a user authenticates with a
  // different Supabase identity (e.g. email/password) than the one used when their
  // staff_users row was created (e.g. via Google OAuth with a different UUID).
  return authUser.email ? getStaffUserRecordByEmail(authUser.email) : null;
}
