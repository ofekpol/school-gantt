import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  createPendingRegistration,
  getPendingRegistrationByAuthId,
  listPendingRegistrations,
  approvePendingRegistration,
  rejectPendingRegistration,
} from "@/lib/db/pending";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA, testSchoolB } from "./setup";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function ensureReviewer(schoolId: string, email: string) {
  const existing = await testDb!
    .select()
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.email, email))
    .limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await testDb!
    .insert(schema.staffUsers)
    .values({ id: randomUUID(), schoolId, email, fullName: "Reviewer", role: "admin" })
    .returning();
  return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// PENDING-01: createPendingRegistration + read functions
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)(
  "PENDING-01: createPendingRegistration and read helpers",
  () => {
    const authUserId = randomUUID();
    const email = `pending-01-${authUserId.slice(0, 8)}@test`;

    beforeAll(async () => {
      if (shouldSkip()) return;
      await createPendingRegistration({
        authUserId,
        email,
        fullName: "Pending User",
        schoolId: testSchoolA,
      });
    });

    it("getPendingRegistrationByAuthId returns null for an unknown authUserId", async () => {
      expect(await getPendingRegistrationByAuthId(randomUUID())).toBeNull();
    });

    it("getPendingRegistrationByAuthId returns the row after creation", async () => {
      const row = await getPendingRegistrationByAuthId(authUserId);
      expect(row).not.toBeNull();
      expect(row!.email).toBe(email);
      expect(row!.fullName).toBe("Pending User");
      expect(row!.reviewOutcome).toBeNull();
    });

    it("createPendingRegistration is idempotent (duplicate does not throw)", async () => {
      await expect(
        createPendingRegistration({ authUserId, email, fullName: "Duplicate", schoolId: testSchoolA }),
      ).resolves.toBeUndefined();
    });

    it("listPendingRegistrations includes the unreviewed row", async () => {
      const rows = await listPendingRegistrations(testSchoolA);
      const found = rows.find((r) => r.authUserId === authUserId);
      expect(found).toBeDefined();
      expect(found!.reviewOutcome).toBeNull();
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PENDING-02: approvePendingRegistration
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)(
  "PENDING-02: approvePendingRegistration creates staff user and marks as approved",
  () => {
    let pendingId: string;
    let pendingAuthUserId: string;
    let approverId: string;

    beforeAll(async () => {
      if (shouldSkip()) return;
      const reviewer = await ensureReviewer(testSchoolA, "pending-approver@test");
      approverId = reviewer.id;

      // Insert a fresh pending registration
      pendingAuthUserId = randomUUID();
      const email = `pending-02-${pendingAuthUserId.slice(0, 8)}@test`;
      await createPendingRegistration({
        authUserId: pendingAuthUserId,
        email,
        fullName: "To Approve",
        googleAvatarUrl: "https://example.com/avatar.jpg",
        schoolId: testSchoolA,
      });

      const [row] = await testDb!
        .select({ id: schema.pendingRegistrations.id })
        .from(schema.pendingRegistrations)
        .where(eq(schema.pendingRegistrations.authUserId, pendingAuthUserId));
      pendingId = row.id;
    });

    it("returns staffUserId, email, fullName on success", async () => {
      const result = await approvePendingRegistration({
        pendingId,
        schoolId: testSchoolA,
        role: "editor",
        fullName: "Approved Editor",
        approvedBy: approverId,
      });
      expect(result.staffUserId).toBe(pendingAuthUserId);
      expect(typeof result.email).toBe("string");
      expect(result.fullName).toBe("Approved Editor");
    });

    it("creates a staff_users row with the correct role and status", async () => {
      const [staff] = await testDb!
        .select()
        .from(schema.staffUsers)
        .where(eq(schema.staffUsers.id, pendingAuthUserId));
      expect(staff).toBeDefined();
      expect(staff.role).toBe("editor");
      expect(staff.status).toBe("active");
      expect(staff.schoolId).toBe(testSchoolA);
    });

    it("sets reviewOutcome=approved on the pending row", async () => {
      const [row] = await testDb!
        .select({ reviewOutcome: schema.pendingRegistrations.reviewOutcome })
        .from(schema.pendingRegistrations)
        .where(eq(schema.pendingRegistrations.id, pendingId));
      expect(row.reviewOutcome).toBe("approved");
    });

    it("approved row no longer appears in listPendingRegistrations", async () => {
      const rows = await listPendingRegistrations(testSchoolA);
      expect(rows.find((r) => r.id === pendingId)).toBeUndefined();
    });

    it("throws when trying to approve the same pending again", async () => {
      await expect(
        approvePendingRegistration({
          pendingId,
          schoolId: testSchoolA,
          role: "editor",
          fullName: "Re-approve",
          approvedBy: approverId,
        }),
      ).rejects.toThrow("pending_registration_not_found");
    });

    it("throws when pendingId does not exist", async () => {
      await expect(
        approvePendingRegistration({
          pendingId: randomUUID(),
          schoolId: testSchoolA,
          role: "editor",
          fullName: "Ghost",
          approvedBy: approverId,
        }),
      ).rejects.toThrow("pending_registration_not_found");
    });

    it("applies grade scopes when gradeScopes are provided", async () => {
      // Create a fresh pending to approve with scopes
      const scopedAuthId = randomUUID();
      await createPendingRegistration({
        authUserId: scopedAuthId,
        email: `scoped-${scopedAuthId.slice(0, 8)}@test`,
        fullName: "Scoped Editor",
        schoolId: testSchoolA,
      });
      const [scopedRow] = await testDb!
        .select({ id: schema.pendingRegistrations.id })
        .from(schema.pendingRegistrations)
        .where(eq(schema.pendingRegistrations.authUserId, scopedAuthId));

      await approvePendingRegistration({
        pendingId: scopedRow.id,
        schoolId: testSchoolA,
        role: "editor",
        fullName: "Scoped Editor",
        gradeScopes: [9, 10],
        approvedBy: approverId,
      });

      const scopes = await testDb!
        .select()
        .from(schema.editorScopes)
        .where(eq(schema.editorScopes.staffUserId, scopedAuthId));
      expect(scopes).toHaveLength(2);
      expect(scopes.map((s) => Number(s.scopeValue)).sort((a, b) => a - b)).toEqual([9, 10]);
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PENDING-03: rejectPendingRegistration
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)(
  "PENDING-03: rejectPendingRegistration marks the row rejected",
  () => {
    let pendingId: string;
    let reviewerId: string;

    beforeAll(async () => {
      if (shouldSkip()) return;
      const reviewer = await ensureReviewer(testSchoolA, "pending-rejector@test");
      reviewerId = reviewer.id;

      const authUserId = randomUUID();
      await createPendingRegistration({
        authUserId,
        email: `pending-03-${authUserId.slice(0, 8)}@test`,
        fullName: "To Reject",
        schoolId: testSchoolA,
      });
      const [row] = await testDb!
        .select({ id: schema.pendingRegistrations.id })
        .from(schema.pendingRegistrations)
        .where(eq(schema.pendingRegistrations.authUserId, authUserId));
      pendingId = row.id;
    });

    it("sets reviewOutcome=rejected in the DB (supabaseAdmin.deleteUser may fail in test env)", async () => {
      // rejectPendingRegistration calls supabaseAdmin.auth.admin.deleteUser after the
      // DB update. In the test environment without real Supabase credentials, that call
      // fails. The DB change is committed before the Supabase call, so we verify the
      // DB state after catching the (expected) Supabase error.
      try {
        await rejectPendingRegistration({ pendingId, schoolId: testSchoolA, reviewedBy: reviewerId });
      } catch {
        // supabaseAdmin.auth.admin.deleteUser is expected to fail in test environment
      }
      const [row] = await testDb!
        .select({ reviewOutcome: schema.pendingRegistrations.reviewOutcome })
        .from(schema.pendingRegistrations)
        .where(eq(schema.pendingRegistrations.id, pendingId));
      expect(row.reviewOutcome).toBe("rejected");
    });

    it("throws pending_registration_not_found when row is already reviewed", async () => {
      // pendingId was rejected above; a second attempt must throw
      await expect(
        rejectPendingRegistration({ pendingId, schoolId: testSchoolA, reviewedBy: reviewerId }),
      ).rejects.toThrow("pending_registration_not_found");
    });

    it("throws pending_registration_not_found when pendingId does not exist", async () => {
      await expect(
        rejectPendingRegistration({ pendingId: randomUUID(), schoolId: testSchoolA, reviewedBy: reviewerId }),
      ).rejects.toThrow("pending_registration_not_found");
    });

    it("rejected row does not appear in listPendingRegistrations", async () => {
      const rows = await listPendingRegistrations(testSchoolA);
      expect(rows.find((r) => r.id === pendingId)).toBeUndefined();
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// PENDING-04: cross-school isolation
// ─────────────────────────────────────────────────────────────────────────────

async function insertPending(schoolId: string | null) {
  const authUserId = randomUUID();
  await createPendingRegistration({
    authUserId,
    email: `pending-04-${authUserId.slice(0, 8)}@test`,
    fullName: "Cross School",
    schoolId,
  });
  const [row] = await testDb!
    .select({ id: schema.pendingRegistrations.id })
    .from(schema.pendingRegistrations)
    .where(eq(schema.pendingRegistrations.authUserId, authUserId));
  return { pendingId: row.id, authUserId };
}

describe.skipIf(skipIfNoTestDb)("PENDING-04: cross-school isolation", () => {
  let schoolARow: { pendingId: string; authUserId: string };
  let noSchoolRow: { pendingId: string; authUserId: string };
  let reviewerBId: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    reviewerBId = (await ensureReviewer(testSchoolB, "pending-reviewer-b@test")).id;
    schoolARow = await insertPending(testSchoolA);
    noSchoolRow = await insertPending(null);
  });

  it("list for school B excludes school A's row", async () => {
    const rows = await listPendingRegistrations(testSchoolB);
    expect(rows.find((r) => r.id === schoolARow.pendingId)).toBeUndefined();
  });

  it("list excludes rows with null school", async () => {
    const rowsA = await listPendingRegistrations(testSchoolA);
    const rowsB = await listPendingRegistrations(testSchoolB);
    expect([...rowsA, ...rowsB].find((r) => r.id === noSchoolRow.pendingId)).toBeUndefined();
  });

  it("approve from school B throws pending_registration_not_found and creates no staff row", async () => {
    await expect(
      approvePendingRegistration({
        pendingId: schoolARow.pendingId,
        schoolId: testSchoolB,
        role: "admin",
        fullName: "Hijack",
        approvedBy: reviewerBId,
      }),
    ).rejects.toThrow("pending_registration_not_found");
    const staff = await testDb!
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.id, schoolARow.authUserId));
    expect(staff).toHaveLength(0);
  });

  it("reject from school B throws pending_registration_not_found and leaves the row unreviewed", async () => {
    await expect(
      rejectPendingRegistration({
        pendingId: schoolARow.pendingId,
        schoolId: testSchoolB,
        reviewedBy: reviewerBId,
      }),
    ).rejects.toThrow("pending_registration_not_found");
    const [row] = await testDb!
      .select({ reviewOutcome: schema.pendingRegistrations.reviewOutcome })
      .from(schema.pendingRegistrations)
      .where(eq(schema.pendingRegistrations.id, schoolARow.pendingId));
    expect(row.reviewOutcome).toBeNull();
  });

  it("approve of a null-school row throws pending_registration_not_found", async () => {
    await expect(
      approvePendingRegistration({
        pendingId: noSchoolRow.pendingId,
        schoolId: testSchoolB,
        role: "editor",
        fullName: "Orphan",
        approvedBy: reviewerBId,
      }),
    ).rejects.toThrow("pending_registration_not_found");
  });
});
