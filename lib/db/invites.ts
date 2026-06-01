import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
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
  multiUse: boolean;
  expiresAt: Date;
  usedAt: Date | null;
  usedBy: string | null;
  createdAt: Date;
}

function rowToRecord(row: Record<string, unknown>): InviteRecord {
  return {
    ...(row as Omit<InviteRecord, "gradeScopes" | "eventTypeScopes">),
    gradeScopes: (row.gradeScopes as number[] | null) ?? [],
    eventTypeScopes: (row.eventTypeScopes as string[] | null) ?? [],
  };
}

export async function createInvite(params: {
  schoolId: string;
  role: "editor" | "admin" | "viewer";
  gradeScopes: number[];
  eventTypeScopes: string[];
  createdBy: string;
  multiUse?: boolean;
  expiresInHours?: number;
}): Promise<{ token: string; expiresAt: Date }> {
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
        multiUse: params.multiUse ?? false,
        expiresAt,
      })
      .returning({ token: staffInvites.token, expiresAt: staffInvites.expiresAt }),
  );
  return { token: row.token, expiresAt: row.expiresAt };
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
  return rowToRecord(row as Record<string, unknown>);
}

/**
 * Atomically marks a single-use invite as used. Returns the number of rows affected
 * (0 = already used or expired; 1 = success). For multi-use invites, always returns 1
 * without touching the DB — they are never consumed.
 *
 * Pass usedBy=null to claim without a resolved staff user id yet; call updateInviteUsedBy
 * afterwards once the staff user is created.
 */
export async function markInviteUsed(
  token: string,
  usedBy: string | null,
  multiUse: boolean,
): Promise<{ affected: number }> {
  if (multiUse) return { affected: 1 };

  const result = await db
    .update(staffInvites)
    .set({ usedAt: new Date(), usedBy })
    .where(
      and(
        eq(staffInvites.token, token),
        isNull(staffInvites.usedAt),
        sql`${staffInvites.expiresAt} > now()`,
      ),
    )
    .returning({ id: staffInvites.id });

  return { affected: result.length };
}

export async function updateInviteUsedBy(token: string, usedBy: string): Promise<void> {
  await db
    .update(staffInvites)
    .set({ usedBy })
    .where(eq(staffInvites.token, token));
}

export async function revokeInvite(id: string, schoolId: string): Promise<void> {
  await withSchool(schoolId, (tx) =>
    tx
      .update(staffInvites)
      .set({ expiresAt: new Date() })
      .where(and(eq(staffInvites.id, id), isNull(staffInvites.usedAt))),
  );
}

export async function listInvitesForSchool(schoolId: string): Promise<InviteRecord[]> {
  const rows = await withSchool(schoolId, (tx) =>
    tx.select().from(staffInvites),
  );
  return rows.map((r) => rowToRecord(r as Record<string, unknown>));
}
