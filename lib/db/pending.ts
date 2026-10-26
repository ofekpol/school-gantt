import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, withSchool } from "@/lib/db/client";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { editorScopes, pendingRegistrations, staffUsers } from "@/lib/db/schema";
import { getStaffUserByAuthId } from "@/lib/db/staff";

export interface PendingRegistrationRecord {
  id: string;
  authUserId: string;
  schoolId: string | null;
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
  /** Resolved server-side from the sign-up link; null when there was none. */
  schoolId: string | null;
}): Promise<void> {
  await db
    .insert(pendingRegistrations)
    .values({
      authUserId: params.authUserId,
      schoolId: params.schoolId,
      email: params.email,
      fullName: params.fullName,
      googleAvatarUrl: params.googleAvatarUrl ?? null,
    })
    .onConflictDoNothing();
}

/**
 * Files a still-open, school-less registration under `schoolId` (the user came
 * back through a school's sign-up link). Never moves a row between schools.
 */
export async function assignPendingSchoolIfMissing(
  authUserId: string,
  schoolId: string,
): Promise<void> {
  await db
    .update(pendingRegistrations)
    .set({ schoolId })
    .where(
      and(
        eq(pendingRegistrations.authUserId, authUserId),
        isNull(pendingRegistrations.schoolId),
        isNull(pendingRegistrations.reviewOutcome),
      ),
    );
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

// pending_registrations has no RLS (read before the school is known), so every
// admin-facing read below filters on school_id explicitly.
function openRowInSchool(pendingId: string, schoolId: string) {
  return and(eq(pendingRegistrations.id, pendingId), eq(pendingRegistrations.schoolId, schoolId));
}

export async function listPendingRegistrations(
  schoolId: string,
): Promise<PendingRegistrationRecord[]> {
  const rows = await db
    .select()
    .from(pendingRegistrations)
    .where(
      and(isNull(pendingRegistrations.reviewOutcome), eq(pendingRegistrations.schoolId, schoolId)),
    );
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
  const [pending] = await db
    .select()
    .from(pendingRegistrations)
    .where(openRowInSchool(params.pendingId, params.schoolId))
    .limit(1);

  if (!pending || pending.reviewOutcome) {
    throw new Error("pending_registration_not_found");
  }

  // The account may have joined another school (e.g. via invite) after landing
  // in pending; approving it here must not touch that school's staff member.
  const existing = await getStaffUserByAuthId(pending.authUserId);
  if (existing?.schoolId && existing.schoolId !== params.schoolId) {
    throw new Error("staff_user_in_other_school");
  }

  await withSchool(params.schoolId, async (tx) => {
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
  });

  await db
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
}

export async function rejectPendingRegistration(params: {
  pendingId: string;
  schoolId: string;
  reviewedBy: string;
}): Promise<void> {
  const [pending] = await db
    .select()
    .from(pendingRegistrations)
    .where(openRowInSchool(params.pendingId, params.schoolId))
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

  // Never delete the auth account of someone who already became staff
  // (possibly in another school) — only close out the pending request.
  const existing = await getStaffUserByAuthId(pending.authUserId);
  if (existing) return;

  await supabaseAdmin.auth.admin.deleteUser(pending.authUserId);
}
