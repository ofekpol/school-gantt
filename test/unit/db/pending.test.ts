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

vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        deleteUser: vi.fn(),
      },
    },
  },
}));

import { approvePendingRegistration } from "@/lib/db/pending";

const SCHOOL = "00000000-0000-0000-0000-000000000001";
const PENDING = "00000000-0000-0000-0000-000000000002";
const AUTH_USER = "00000000-0000-0000-0000-000000000003";
const APPROVER = "00000000-0000-0000-0000-000000000004";

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
});
