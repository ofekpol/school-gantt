import "server-only";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { editorScopes, pendingRegistrations, staffUsers } from "@/lib/db/schema";

export interface PendingRegistrationRecord {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  googleAvatarUrl: string | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewOutcome: string | null;
}

export async function createPendingRegistration(params: {
  authUserId: string;
  email: string;
  fullName: string;
  googleAvatarUrl?: string | null;
}): Promise<void> {
  await db
    .insert(pendingRegistrations)
    .values({
      authUserId: params.authUserId,
      email: params.email,
      fullName: params.fullName,
      googleAvatarUrl: params.googleAvatarUrl ?? null,
    })
    .onConflictDoNothing();
}

export async function getPendingRegistrationByAuthId(
  authUserId: string,
): Promise<PendingRegistrationRecord | null> {
  const [row] = await db
    .select()
    .from(pendingRegistrations)
    .where(eq(pendingRegistrations.authUserId, authUserId))
    .limit(1);
  return (row as PendingRegistrationRecord | undefined) ?? null;
}

export async function listPendingRegistrations(): Promise<PendingRegistrationRecord[]> {
  const rows = await db
    .select()
    .from(pendingRegistrations)
    .where(isNull(pendingRegistrations.reviewOutcome));
  return rows as PendingRegistrationRecord[];
}

export async function approvePendingRegistration(params: {
  pendingId: string;
  schoolId: string;
  role: "editor" | "admin" | "viewer";
  fullName: string;
  gradeScopes?: number[];
  eventTypeScopes?: string[];
  approvedBy: string;
}): Promise<{ staffUserId: string; email: string; fullName: string }> {
  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select()
      .from(pendingRegistrations)
      .where(eq(pendingRegistrations.id, params.pendingId))
      .limit(1);

    if (!pending || pending.reviewOutcome) {
      throw new Error("pending_registration_not_found");
    }

    await tx
      .insert(staffUsers)
      .values({
        id: pending.authUserId,
        schoolId: params.schoolId,
        email: pending.email,
        fullName: params.fullName,
        role: params.role,
        status: "active",
      })
      .onConflictDoNothing({ target: staffUsers.id });

    const scopeRows: Array<{
      staffUserId: string;
      schoolId: string;
      scopeKind: "grade" | "event_type";
      scopeValue: string;
    }> = [
      ...(params.gradeScopes ?? []).map((g) => ({
        staffUserId: pending.authUserId,
        schoolId: params.schoolId,
        scopeKind: "grade" as const,
        scopeValue: String(g),
      })),
      ...(params.eventTypeScopes ?? []).map((k) => ({
        staffUserId: pending.authUserId,
        schoolId: params.schoolId,
        scopeKind: "event_type" as const,
        scopeValue: k,
      })),
    ];

    if (scopeRows.length > 0) {
      await tx.insert(editorScopes).values(scopeRows).onConflictDoNothing();
    }

    await tx
      .update(pendingRegistrations)
      .set({
        reviewedAt: new Date(),
        reviewedBy: params.approvedBy,
        reviewOutcome: "approved",
      })
      .where(eq(pendingRegistrations.id, params.pendingId));

    return {
      staffUserId: pending.authUserId,
      email: pending.email,
      fullName: params.fullName,
    };
  });
}

export async function rejectPendingRegistration(params: {
  pendingId: string;
  reviewedBy: string;
}): Promise<void> {
  const [pending] = await db
    .select()
    .from(pendingRegistrations)
    .where(eq(pendingRegistrations.id, params.pendingId))
    .limit(1);

  if (!pending || pending.reviewOutcome) {
    throw new Error("pending_registration_not_found");
  }

  await db
    .update(pendingRegistrations)
    .set({
      reviewedAt: new Date(),
      reviewedBy: params.reviewedBy,
      reviewOutcome: "rejected",
    })
    .where(eq(pendingRegistrations.id, params.pendingId));

  await supabaseAdmin.auth.admin.deleteUser(pending.authUserId);
}
