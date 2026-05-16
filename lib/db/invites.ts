import "server-only";
import { eq } from "drizzle-orm";
import { db, withSchool } from "@/lib/db/client";
import { staffInvites } from "@/lib/db/schema";

export interface InviteRecord {
  id: string;
  token: string;
  schoolId: string;
  role: "editor" | "admin" | "viewer";
  gradeScopes: number[];
  eventTypeScopes: string[];
  createdBy: string;
  expiresAt: Date;
  usedAt: Date | null;
  usedBy: string | null;
  createdAt: Date;
}

export async function createInvite(params: {
  schoolId: string;
  role: "editor" | "admin" | "viewer";
  gradeScopes: number[];
  eventTypeScopes: string[];
  createdBy: string;
  expiresInHours?: number;
}): Promise<{ token: string }> {
  const expiresAt = new Date(
    Date.now() + (params.expiresInHours ?? 72) * 60 * 60 * 1000,
  );
  const [row] = await withSchool(params.schoolId, (tx) =>
    tx
      .insert(staffInvites)
      .values({
        schoolId: params.schoolId,
        role: params.role,
        gradeScopes: params.gradeScopes,
        eventTypeScopes: params.eventTypeScopes,
        createdBy: params.createdBy,
        expiresAt,
      })
      .returning({ token: staffInvites.token }),
  );
  return { token: row.token };
}

/**
 * Looks up an invite by token using the raw service-role client (no school context
 * needed — callers don't know the school until after the invite is validated).
 */
export async function getInviteByToken(token: string): Promise<InviteRecord | null> {
  const [row] = await db
    .select()
    .from(staffInvites)
    .where(eq(staffInvites.token, token))
    .limit(1);
  if (!row) return null;
  return row as InviteRecord;
}

export async function markInviteUsed(token: string, usedBy: string): Promise<void> {
  await db
    .update(staffInvites)
    .set({ usedAt: new Date(), usedBy })
    .where(eq(staffInvites.token, token));
}

export async function listInvitesForSchool(schoolId: string): Promise<InviteRecord[]> {
  const rows = await withSchool(schoolId, (tx) =>
    tx.select().from(staffInvites),
  );
  return rows as InviteRecord[];
}
