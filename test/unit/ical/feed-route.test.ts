import { beforeEach, describe, expect, it, vi } from "vitest";

const getSubscriptionByTokenMock = vi.fn();
vi.mock("@/lib/ical/subscriptions", () => ({
  getSubscriptionByToken: (...args: unknown[]) => getSubscriptionByTokenMock(...args),
}));

const schoolRows = [{ slug: "kfar-galim", name: "כפר גלים" }];
vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => schoolRows,
        }),
      }),
    }),
  },
}));

const listEventTypesMock = vi.fn();
vi.mock("@/lib/events/queries", () => ({
  listEventTypes: (...args: unknown[]) => listEventTypesMock(...args),
}));

const getAgendaForSchoolMock = vi.fn();
vi.mock("@/lib/views/agenda", () => ({
  getAgendaForSchool: (...args: unknown[]) => getAgendaForSchoolMock(...args),
}));

const serializeCalendarMock = vi.fn();
vi.mock("@/lib/ical/serializer", () => ({
  serializeCalendar: (...args: unknown[]) => serializeCalendarMock(...args),
}));

import { GET } from "@/app/ical/[token]/route";

const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  getSubscriptionByTokenMock.mockReset();
  listEventTypesMock.mockReset();
  getAgendaForSchoolMock.mockReset();
  serializeCalendarMock.mockReset();

  getSubscriptionByTokenMock.mockResolvedValue({
    id: "sub-1",
    schoolId: SCHOOL_ID,
    staffUserId: "staff-1",
    filterGrades: [],
    filterEventTypes: [],
    revokedAt: null,
  });
  listEventTypesMock.mockResolvedValue([]);
  serializeCalendarMock.mockReturnValue("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
});

describe("GET /ical/[token]", () => {
  it("omits canceled events so Google subscriptions remove deleted school events", async () => {
    getAgendaForSchoolMock.mockResolvedValue([
      agendaEvent({ id: "approved-1", title: "Visible lesson", isCanceled: false }),
      agendaEvent({ id: "canceled-1", title: "test", isCanceled: true }),
    ]);

    const res = await GET(
      new Request("http://localhost/ical/token-123") as never,
      { params: Promise.resolve({ token: "token-123" }) },
    );

    expect(res.status).toBe(200);
    expect(serializeCalendarMock).toHaveBeenCalledWith({
      schoolName: "כפר גלים",
      schoolSlug: "kfar-galim",
      events: [
        expect.objectContaining({
          id: "approved-1",
          title: "Visible lesson",
        }),
      ],
    });
  });
});

function agendaEvent(overrides: { id: string; title: string; isCanceled: boolean }) {
  return {
    id: overrides.id,
    title: overrides.title,
    description: null,
    location: null,
    startAt: new Date("2026-06-08T06:00:00.000Z"),
    endAt: new Date("2026-06-08T07:00:00.000Z"),
    allDay: false,
    eventTypeId: "type-1",
    eventTypeKey: "general",
    eventTypeLabelHe: "כללי",
    eventTypeColor: "#f59e0b",
    eventTypeGlyph: "tag",
    grades: [7],
    status: overrides.isCanceled ? "canceled" : "approved",
    isCanceled: overrides.isCanceled,
    isUpdated: false,
  };
}
