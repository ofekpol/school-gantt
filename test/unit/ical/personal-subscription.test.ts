import { beforeEach, describe, expect, it, vi } from "vitest";

const withSchoolMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  withSchool: (...args: unknown[]) => withSchoolMock(...args),
}));

import {
  buildPersonalSubscriptionFilters,
  createPersonalCalendarSubscription,
  NO_MATCHING_EVENT_TYPE_FILTER,
} from "@/lib/ical/subscriptions";

type StaffRole = "editor" | "admin" | "viewer";

const SCHOOL = "00000000-0000-0000-0000-000000000001";
const USER = "00000000-0000-0000-0000-000000000002";
const TYPE_TRIP = "00000000-0000-0000-0000-0000000000a1";
const TYPE_EXAM = "00000000-0000-0000-0000-0000000000a2";

function makeUser(role: StaffRole) {
  return {
    id: USER,
    schoolId: SCHOOL,
    role,
    status: "active" as const,
  };
}

function makeTx(opts: {
  gradeScopes?: string[];
  eventTypeScopes?: string[];
  eventTypes?: Array<{ id: string; key: string }>;
  insertResult?: Array<{ id: string }>;
}) {
  let selectCount = 0;
  const tx = {
    select: () => {
      const rows =
        selectCount === 0
          ? (opts.gradeScopes ?? []).map((scopeValue) => ({ scopeValue }))
          : selectCount === 1
            ? (opts.eventTypeScopes ?? []).map((scopeValue) => ({ scopeValue }))
            : (opts.eventTypes ?? []);
      selectCount++;
      return makeChain(rows);
    },
    insert: () => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => opts.insertResult ?? [{ id: "sub-1" }]),
      })),
    }),
  };
  return tx;
}

function makeChain(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  const chain = {
    from: () => chain,
    where: () => chain,
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      promise.then(resolve, reject),
    catch: (reject: (reason: unknown) => unknown) => promise.catch(reject),
  };
  return chain;
}

function useTx(tx: ReturnType<typeof makeTx>) {
  withSchoolMock.mockImplementation(async (_schoolId: string, fn: (tx: ReturnType<typeof makeTx>) => unknown) =>
    fn(tx),
  );
}

beforeEach(() => {
  withSchoolMock.mockReset();
});

describe("buildPersonalSubscriptionFilters", () => {
  it("returns empty filters for admins, meaning all events", async () => {
    useTx(makeTx({}));

    await expect(buildPersonalSubscriptionFilters(makeUser("admin"))).resolves.toEqual({
      grades: [],
      eventTypes: [],
    });
  });

  it("returns empty filters for viewers, meaning all events", async () => {
    useTx(makeTx({}));

    await expect(buildPersonalSubscriptionFilters(makeUser("viewer"))).resolves.toEqual({
      grades: [],
      eventTypes: [],
    });
  });

  it("uses editor grade scopes and all event types when no event-type scopes exist", async () => {
    useTx(makeTx({ gradeScopes: ["9", "11"], eventTypeScopes: [] }));

    await expect(buildPersonalSubscriptionFilters(makeUser("editor"))).resolves.toEqual({
      grades: [9, 11],
      eventTypes: [],
    });
  });

  it("maps editor event-type key scopes to event type ids", async () => {
    useTx(makeTx({
      gradeScopes: [],
      eventTypeScopes: ["trip"],
      eventTypes: [
        { id: TYPE_TRIP, key: "trip" },
        { id: TYPE_EXAM, key: "exam" },
      ],
    }));

    await expect(buildPersonalSubscriptionFilters(makeUser("editor"))).resolves.toEqual({
      grades: [7, 8, 9, 10, 11, 12],
      eventTypes: [TYPE_TRIP],
    });
  });

  it("stores a non-matching filter when editor event-type scopes are stale", async () => {
    useTx(makeTx({
      gradeScopes: [],
      eventTypeScopes: ["deleted-type"],
      eventTypes: [{ id: TYPE_TRIP, key: "trip" }],
    }));

    await expect(buildPersonalSubscriptionFilters(makeUser("editor"))).resolves.toEqual({
      grades: [7, 8, 9, 10, 11, 12],
      eventTypes: [NO_MATCHING_EVENT_TYPE_FILTER],
    });
  });
});

describe("createPersonalCalendarSubscription", () => {
  it("stores server-computed filters and returns the new token", async () => {
    useTx(makeTx({
      gradeScopes: ["10"],
      eventTypeScopes: ["exam"],
      eventTypes: [{ id: TYPE_EXAM, key: "exam" }],
      insertResult: [{ id: "sub-123" }],
    }));

    const result = await createPersonalCalendarSubscription(makeUser("editor"));

    expect(result.id).toBe("sub-123");
    expect(result.token.length).toBeGreaterThanOrEqual(40);
  });
});
