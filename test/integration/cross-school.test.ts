import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { createStaffUserFromInvite, updateStaffUser } from "@/lib/db/staff";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA, testSchoolB } from "./setup";

const signOutMock = vi.fn();
vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: { auth: { admin: { signOut: (...args: unknown[]) => signOutMock(...args) } } },
}));

// ─────────────────────────────────────────────────────────────────────────────
// XSCHOOL-STAFF: an admin of school B cannot touch school A's staff
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)("XSCHOOL-STAFF: updateStaffUser across schools", () => {
  let editorA: string;

  beforeAll(async () => {
    if (shouldSkip()) return;
    editorA = randomUUID();
    await createStaffUserFromInvite({
      authUserId: editorA,
      schoolId: testSchoolA,
      email: `xschool-editor-${editorA}@test`,
      fullName: "Editor A",
      role: "editor",
      gradeScopes: [9],
    });
  });

  beforeEach(() => signOutMock.mockReset());

  async function rowA() {
    const [row] = await testDb!.select().from(schema.staffUsers).where(eq(schema.staffUsers.id, editorA));
    return row;
  }

  async function scopesA() {
    return testDb!
      .select({ value: schema.editorScopes.scopeValue })
      .from(schema.editorScopes)
      .where(eq(schema.editorScopes.staffUserId, editorA));
  }

  it("rename from school B throws 404 and changes nothing", async () => {
    await expect(updateStaffUser(testSchoolB, editorA, { fullName: "Hijacked" })).rejects.toMatchObject({
      status: 404,
    });
    expect((await rowA()).fullName).toBe("Editor A");
  });

  it("scope-only update from school B leaves A's editor_scopes intact", async () => {
    await expect(updateStaffUser(testSchoolB, editorA, { gradeScopes: [7] })).rejects.toMatchObject({
      status: 404,
    });
    expect((await scopesA()).map((s) => s.value)).toEqual(["9"]);
  });

  it("deactivate from school B never calls signOut", async () => {
    await expect(updateStaffUser(testSchoolB, editorA, { deactivated: true })).rejects.toMatchObject({
      status: 404,
    });
    expect(signOutMock).not.toHaveBeenCalled();
    expect((await rowA()).status).toBe("active");
  });

  it("deactivate from school A still signs the user out", async () => {
    await updateStaffUser(testSchoolA, editorA, { deactivated: true });
    expect(signOutMock).toHaveBeenCalledWith(editorA, "global");
    await updateStaffUser(testSchoolA, editorA, { deactivated: false });
  });
});
