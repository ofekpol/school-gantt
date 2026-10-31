import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMock = vi.fn();
const deleteMock = vi.fn();
const insertMock = vi.fn();
let visibleRows: Array<{ id: string }> = [];

// tx whose RLS-scoped lookup of the target staff user returns `visibleRows`
// (empty = the id belongs to another school).
const tx = {
  select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(visibleRows) }) }) }),
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
  withSchool: async (_schoolId: string, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
}));

const updateUserByIdMock = vi.fn();
vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: {
    auth: { admin: { updateUserById: (...args: unknown[]) => updateUserByIdMock(...args) } },
  },
}));

import { updateStaffUser } from "@/lib/db/staff";
import { icalSubscriptions, staffUsers } from "@/lib/db/schema";

const SCHOOL_A = "00000000-0000-0000-0000-00000000000a";
const SCHOOL_B = "00000000-0000-0000-0000-00000000000b";
const STAFF_A = "00000000-0000-0000-0000-0000000000a2";

beforeEach(() => {
  vi.clearAllMocks();
  updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
});

describe("updateStaffUser on a staff id not visible in the caller's school", () => {
  beforeEach(() => {
    visibleRows = [];
  });

  it("throws 404 before writing anything", async () => {
    await expect(
      updateStaffUser(SCHOOL_B, STAFF_A, { fullName: "x", gradeScopes: [7] }),
    ).rejects.toMatchObject({ status: 404 });
    expect(updateMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("never bans the user", async () => {
    await expect(updateStaffUser(SCHOOL_B, STAFF_A, { deactivated: true })).rejects.toMatchObject({
      status: 404,
    });
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });
});

describe("updateStaffUser deactivation", () => {
  beforeEach(() => {
    visibleRows = [{ id: STAFF_A }];
  });

  it("bans the auth user and revokes their iCal feeds", async () => {
    await updateStaffUser(SCHOOL_A, STAFF_A, { deactivated: true });
    expect(updateUserByIdMock).toHaveBeenCalledWith(STAFF_A, { ban_duration: "876000h" });
    expect(updateMock).toHaveBeenCalledWith(staffUsers);
    expect(updateMock).toHaveBeenCalledWith(icalSubscriptions);
  });

  it("fails when the ban fails instead of ignoring it", async () => {
    updateUserByIdMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(updateStaffUser(SCHOOL_A, STAFF_A, { deactivated: true })).rejects.toThrow(/boom/);
  });

  it("lifts the ban on reactivation", async () => {
    await updateStaffUser(SCHOOL_A, STAFF_A, { deactivated: false });
    expect(updateUserByIdMock).toHaveBeenCalledWith(STAFF_A, { ban_duration: "none" });
    expect(updateMock).not.toHaveBeenCalledWith(icalSubscriptions);
  });

  it("leaves the ban alone on unrelated edits", async () => {
    await updateStaffUser(SCHOOL_A, STAFF_A, { fullName: "Renamed" });
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });
});
