import "server-only";
import { and, eq } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import { editorScopes } from "@/lib/db/schema";

export interface StaffUser {
  id: string;
  schoolId: string;
  role: "editor" | "admin" | "viewer";
  status: "pending" | "active" | "deactivated";
}

/**
 * Throws a 403 Response if `user` lacks the required grade or event-type scope.
 * Admins (role='admin') bypass all scope checks (AUTH-06).
 * Returns silently if no checks specified.
 */
export async function assertEditorScope(
  user: StaffUser,
  grade?: number,
  eventType?: string,
): Promise<void> {
  if (user.role === "admin") return;
  if (user.role === "viewer") throw new Response("Forbidden", { status: 403 });
  if (user.status !== "active") throw new Response("Forbidden", { status: 403 });

  if (grade !== undefined) {
    const rows = await withSchool(user.schoolId, (tx) =>
      tx
        .select({ id: editorScopes.id })
        .from(editorScopes)
        .where(
          and(
            eq(editorScopes.staffUserId, user.id),
            eq(editorScopes.scopeKind, "grade"),
            eq(editorScopes.scopeValue, String(grade)),
          ),
        )
        .limit(1),
    );
    if (rows.length === 0) {
      throw new Response("Forbidden: missing grade scope", { status: 403 });
    }
  }

  if (eventType !== undefined) {
    const rows = await withSchool(user.schoolId, (tx) =>
      tx
        .select({ id: editorScopes.id })
        .from(editorScopes)
        .where(
          and(
            eq(editorScopes.staffUserId, user.id),
            eq(editorScopes.scopeKind, "event_type"),
            eq(editorScopes.scopeValue, eventType),
          ),
        )
        .limit(1),
    );
    if (rows.length === 0) {
      throw new Response("Forbidden: missing event_type scope", { status: 403 });
    }
  }
}
