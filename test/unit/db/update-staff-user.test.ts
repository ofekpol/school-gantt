import { beforeEach, describe, expect, it, vi } from "vitest";

// tx where the RLS-scoped lookup of the target staff user finds nothing
// (i.e. the id belongs to another school).
const updateMock = vi.fn();
const deleteMock = vi.fn();
const insertMock = vi.fn();
const invisibleTx = {
  select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
  update: (...args: unknown[]) => {
    updateMock(...args);
    return { set: () => ({ where: () => Promise.resolve([]) }) };
  },
  delete: (...args: unknown[]) => {
    deleteMock(...args);
    return { where: () => Promise.resolve([]) };
  },
  insert: (...args: unknown[]) => {
    insertMock(...args);
    return { values: () => Promise.resolve([]) };
  },
};

vi.mock("@/lib/db/client", () => ({
  db: {},
  withSchool: async (_schoolId: string, fn: (tx: typeof invisibleTx) => Promise<unknown>) => fn(invisibleTx),
}));

const signOutMock = vi.fn();
vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: { auth: { admin: { signOut: (...args: unknown[]) => signOutMock(...args) } } },
}));

import { updateStaffUser } from "@/lib/db/staff";

const SCHOOL_B = "00000000-0000-0000-0000-00000000000b";
const STAFF_A = "00000000-0000-0000-0000-0000000000a2";

describe("updateStaffUser on a staff id not visible in the caller's school", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws 404 before writing anything", async () => {
    await expect(
      updateStaffUser(SCHOOL_B, STAFF_A, { fullName: "x", gradeScopes: [7] }),
    ).rejects.toMatchObject({ status: 404 });
    expect(updateMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("never signs the user out", async () => {
    await expect(updateStaffUser(SCHOOL_B, STAFF_A, { deactivated: true })).rejects.toMatchObject({
      status: 404,
    });
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
