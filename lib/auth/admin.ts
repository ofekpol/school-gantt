import "server-only";
import type { StaffUserRecord } from "@/lib/db/staff";

/**
 * Guard for /admin/* routes. Throws Response(403) if user is not an admin.
 * Mirror style: lib/auth/scopes.ts assertEditorScope.
 */
export function assertAdmin(
  user: StaffUserRecord | null,
): asserts user is StaffUserRecord & { role: "admin"; schoolId: string } {
  if (!user) throw new Response("Unauthorized", { status: 401 });
  if (!user.schoolId) throw new Response("Forbidden", { status: 403 });
  if (user.status !== "active") throw new Response("Forbidden", { status: 403 });
  if (user.role !== "admin") throw new Response("Forbidden", { status: 403 });
}
