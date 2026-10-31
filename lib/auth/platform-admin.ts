import "server-only";
import type { User } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/db/platform-admins";

/**
 * Guard for /platform/* and /api/v1/platform/*. Keyed on the Supabase Auth
 * user, not `staff_users`, so a platform admin needn't belong to a school.
 * Throws Response(401/403) like `assertAdmin`.
 */
export async function requirePlatformAdmin(): Promise<User> {
  const user = await getSession();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  if (!(await isPlatformAdmin(user.id))) throw new Response("Forbidden", { status: 403 });
  return user;
}
