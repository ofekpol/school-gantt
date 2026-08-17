import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const createUserMock = vi.fn();
const deleteUserMock = vi.fn();

vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: (...args: unknown[]) => createUserMock(...args),
        deleteUser: (...args: unknown[]) => deleteUserMock(...args),
      },
    },
  },
}));

import { createStaffUserDirect } from "@/lib/db/staff";
import { listStaffUsers } from "@/lib/db/staff";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA, testSchoolB } from "./setup";

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-04: Direct staff creation (admin-add-by-email)
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("ADMIN-04: admin creates a staff user directly", () => {
  beforeAll(() => {
    if (shouldSkip()) return;
    createUserMock.mockReset();
    deleteUserMock.mockReset();
  });

  it("creates staff_users + editor_scopes rows scoped to the admin's school, with mustChangePassword=true", async () => {
    const authUserId = randomUUID();
    createUserMock.mockResolvedValueOnce({ data: { user: { id: authUserId } }, error: null });

    const email = `admin04-editor-${authUserId.slice(0, 8)}@test`;
    const result = await createStaffUserDirect({
      schoolId: testSchoolA,
      email,
      fullName: "Direct Editor",
      role: "editor",
      password: "Temp1234xy",
      gradeScopes: [10],
      eventTypeScopes: ["trip"],
    });

    expect(result.id).toBe(authUserId);

    const [row] = await testDb!
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.id, authUserId));
    expect(row.schoolId).toBe(testSchoolA);
    expect(row.status).toBe("active");
    expect(row.mustChangePassword).toBe(true);
    expect(row.role).toBe("editor");

    const scopes = await testDb!
      .select()
      .from(schema.editorScopes)
      .where(eq(schema.editorScopes.staffUserId, authUserId));
    expect(scopes).toHaveLength(2);
  });

  it("does not leak the created row into another school's listStaffUsers", async () => {
    const authUserId = randomUUID();
    createUserMock.mockResolvedValueOnce({ data: { user: { id: authUserId } }, error: null });

    await createStaffUserDirect({
      schoolId: testSchoolA,
      email: `admin04-isolation-${authUserId.slice(0, 8)}@test`,
      fullName: "Isolation Check",
      role: "viewer",
      password: "Temp1234xy",
    });

    const schoolBStaff = await listStaffUsers(testSchoolB);
    expect(schoolBStaff.map((u) => u.id)).not.toContain(authUserId);

    const schoolAStaff = await listStaffUsers(testSchoolA);
    expect(schoolAStaff.map((u) => u.id)).toContain(authUserId);
  });

  it("pre-check rejects a duplicate email before creating a Supabase Auth user, even across schools", async () => {
    const authUserId = randomUUID();
    createUserMock.mockResolvedValueOnce({ data: { user: { id: authUserId } }, error: null });

    const email = `admin04-precheck-${authUserId.slice(0, 8)}@test`;
    await createStaffUserDirect({
      schoolId: testSchoolA,
      email,
      fullName: "Original Owner",
      role: "viewer",
      password: "Temp1234xy",
    });

    // staff_users.email is a global unique constraint (not scoped per-school), so a
    // second admin — even from a different school — must be rejected by the
    // getStaffUserByEmail pre-check BEFORE any Supabase Auth user is created. This
    // is what closes the orphaned-auth-user / cross-tenant-signin window described
    // in the design spec's rollback section.
    createUserMock.mockClear();

    await expect(
      createStaffUserDirect({
        schoolId: testSchoolB,
        email,
        fullName: "Attempted Duplicate",
        role: "viewer",
        password: "Temp1234xy",
      }),
    ).rejects.toThrow(/already registered/i);

    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rolls back the auth user when the DB insert fails (duplicate id)", async () => {
    const authUserId = randomUUID();
    // First call succeeds and creates the row...
    createUserMock.mockResolvedValueOnce({ data: { user: { id: authUserId } }, error: null });
    await createStaffUserDirect({
      schoolId: testSchoolA,
      email: `admin04-conflict-${authUserId.slice(0, 8)}@test`,
      fullName: "Conflict Source",
      role: "viewer",
      password: "Temp1234xy",
    });

    // ...then a second call reuses the same auth id, so the staff_users insert
    // hits the primary key constraint and createStaffUserDirect must roll back.
    createUserMock.mockResolvedValueOnce({ data: { user: { id: authUserId } }, error: null });
    deleteUserMock.mockResolvedValueOnce({ error: null });

    await expect(
      createStaffUserDirect({
        schoolId: testSchoolA,
        email: `admin04-conflict-2-${authUserId.slice(0, 8)}@test`,
        fullName: "Conflict Retry",
        role: "viewer",
        password: "Temp1234xy",
      }),
    ).rejects.toThrow();

    expect(deleteUserMock).toHaveBeenCalledWith(authUserId);
  });
});
