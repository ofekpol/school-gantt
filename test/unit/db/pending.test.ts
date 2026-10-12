import { beforeEach, describe, expect, it, vi } from "vitest";

const withSchoolMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    transaction: (...args: unknown[]) => transactionMock(...args),
    select: () => makeTx().select(),
    update: () => makeTx().update(),
  },
  withSchool: (...args: unknown[]) => withSchoolMock(...args),
}));

const deleteUserMock = vi.fn();
vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => deleteUserMock(...args),
      },
    },
  },
}));

const getStaffUserByAuthIdMock = vi.fn();
vi.mock("@/lib/db/staff", () => ({
  getStaffUserByAuthId: (...args: unknown[]) => getStaffUserByAuthIdMock(...args),
}));

import { approvePendingRegistration, rejectPendingRegistration } from "@/lib/db/pending";
import { ApprovePendingSchema } from "@/lib/validations/admin";

const SCHOOL = "00000000-0000-0000-0000-000000000001";
const PENDING = "00000000-0000-0000-0000-000000000002";
const AUTH_USER = "00000000-0000-0000-0000-000000000003";
const APPROVER = "00000000-0000-0000-0000-000000000004";
const OTHER_SCHOOL = "00000000-0000-0000-0000-000000000005";

function makeTx() {
  const selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    limit: () =>
      Promise.resolve([
        {
          id: PENDING,
          authUserId: AUTH_USER,
          email: "pending@example.com",
          fullName: "Pending User",
          reviewOutcome: null,
        },
      ]),
  };

  return {
    select: () => selectChain,
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => Promise.resolve([]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  };
}

type MockTx = ReturnType<typeof makeTx>;
type TxCallback = (tx: MockTx) => Promise<unknown>;

beforeEach(() => {
  withSchoolMock.mockReset();
  transactionMock.mockReset();
  deleteUserMock.mockReset();
  getStaffUserByAuthIdMock.mockReset();
  getStaffUserByAuthIdMock.mockResolvedValue(null);
  const tx = makeTx();
  withSchoolMock.mockImplementation(async (_schoolId: unknown, fn: TxCallback) => fn(tx));
  transactionMock.mockImplementation(async (fn: TxCallback) => fn(tx));
});

describe("approvePendingRegistration", () => {
  it("runs staff and scope writes inside the target school's RLS context", async () => {
    await approvePendingRegistration({
      pendingId: PENDING,
      schoolId: SCHOOL,
      role: "editor",
      fullName: "Approved Editor",
      gradeScopes: [9],
      eventTypeScopes: ["trip"],
      approvedBy: APPROVER,
    });

    expect(withSchoolMock).toHaveBeenCalledWith(SCHOOL, expect.any(Function));
  });

  it("refuses to approve an account that is already staff in another school", async () => {
    getStaffUserByAuthIdMock.mockResolvedValue({ id: AUTH_USER, schoolId: OTHER_SCHOOL });

    await expect(
      approvePendingRegistration({
        pendingId: PENDING,
        schoolId: SCHOOL,
        role: "admin",
        fullName: "Hijack",
        approvedBy: APPROVER,
      }),
    ).rejects.toThrow("staff_user_in_other_school");
    expect(withSchoolMock).not.toHaveBeenCalled();
  });
});

describe("rejectPendingRegistration", () => {
  it("deletes the auth account when the user never became staff", async () => {
    await rejectPendingRegistration({ pendingId: PENDING, reviewedBy: APPROVER });
    expect(deleteUserMock).toHaveBeenCalledWith(AUTH_USER);
  });

  it("does not delete the auth account of an existing staff member", async () => {
    getStaffUserByAuthIdMock.mockResolvedValue({ id: AUTH_USER, schoolId: OTHER_SCHOOL });
    await rejectPendingRegistration({ pendingId: PENDING, reviewedBy: APPROVER });
    expect(deleteUserMock).not.toHaveBeenCalled();
  });
});

describe("ApprovePendingSchema", () => {
  it("drops a client-supplied schoolId", () => {
    const parsed = ApprovePendingSchema.parse({
      action: "approve",
      pendingId: PENDING,
      schoolId: OTHER_SCHOOL,
      role: "admin",
      fullName: "x",
    });
    expect(parsed).not.toHaveProperty("schoolId");
  });
});
