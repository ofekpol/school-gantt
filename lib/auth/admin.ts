import "server-only";
import type { StaffUserRecord } from "@/lib/db/staff";

/**
 * Guard for /admin/* routes. Throws Response(403) if user is not an admin.
 * Mirror style: lib/auth/scopes.ts assertEditorScope.
 */
export function assertAdmin(user: StaffUserRecord | null): asserts user is StaffUserRecord {
  if (!user) {
    throw new Response("Unauthorized", { status: 401 });
  }
  if (user.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }
}
