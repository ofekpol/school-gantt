import { describe, expect, it } from "vitest";
import {
  EventDraftSchema,
  EventSubmitSchema,
  ICalSubscriptionSchema,
  RejectSchema,
} from "@/lib/validations/events";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_DT = "2026-09-01T08:00:00+03:00"; // ISO 8601 with offset
const END_DT = "2026-09-01T16:00:00+03:00";

// ─────────────────────────────────────────────────────────────────────────────
// EventDraftSchema  (all fields optional — used for wizard autosave / PATCH)
// ─────────────────────────────────────────────────────────────────────────────

describe("EventDraftSchema: all-optional autosave schema (PATCH /api/v1/events/:id)", () => {
  it("accepts an empty object — every field is optional", () => {
    expect(EventDraftSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial update with only title provided", () => {
    expect(EventDraftSchema.safeParse({ title: "Trip to Haifa" }).success).toBe(true);
  });

  it("accepts a complete valid payload", () => {
    const result = EventDraftSchema.safeParse({
      title: "Field trip",
      description: "Annual trip",
      location: "Haifa",
      startAt: VALID_DT,
      endAt: END_DT,
      allDay: false,
      eventTypeId: VALID_UUID,
      grades: [7, 8, 9],
    });
    expect(result.success).toBe(true);
  });

  it("rejects title that is an empty string (min 1)", () => {
    const r = EventDraftSchema.safeParse({ title: "" });
    expect(r.success).toBe(false);
  });

  it("rejects title longer than 255 characters", () => {
    const r = EventDraftSchema.safeParse({ title: "x".repeat(256) });
    expect(r.success).toBe(false);
  });

  it("rejects startAt that is not a valid ISO datetime string", () => {
    const r = EventDraftSchema.safeParse({ startAt: "not-a-date" });
    expect(r.success).toBe(false);
  });

  it("rejects startAt without timezone offset", () => {
    // datetime({ offset: true }) requires an explicit offset
    const r = EventDraftSchema.safeParse({ startAt: "2026-09-01T08:00:00" });
    expect(r.success).toBe(false);
  });

  it("rejects eventTypeId that is not a valid UUID", () => {
    const r = EventDraftSchema.safeParse({ eventTypeId: "not-a-uuid" });
    expect(r.success).toBe(false);
  });

  it("rejects a grade below 7", () => {
    const r = EventDraftSchema.safeParse({ grades: [6] });
    expect(r.success).toBe(false);
  });

  it("rejects a grade above 12", () => {
    const r = EventDraftSchema.safeParse({ grades: [13] });
    expect(r.success).toBe(false);
  });

  it("accepts grades array with valid grades 7–12", () => {
    expect(EventDraftSchema.safeParse({ grades: [7, 10, 12] }).success).toBe(true);
  });

  it("accepts allDay=true without startAt/endAt time components", () => {
    expect(EventDraftSchema.safeParse({ allDay: true }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EventSubmitSchema  (strict — all fields required at publish step)
// ─────────────────────────────────────────────────────────────────────────────

describe("EventSubmitSchema: strict publish schema (POST /api/v1/events/:id/submit)", () => {
  const VALID = {
    title: "Field trip",
    startAt: VALID_DT,
    endAt: END_DT,
    eventTypeId: VALID_UUID,
    grades: [9],
  };

  it("accepts a fully populated valid payload", () => {
    expect(EventSubmitSchema.safeParse(VALID).success).toBe(true);
  });

  it("rejects when title is missing", () => {
    const { title: _, ...rest } = VALID;
    expect(EventSubmitSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects when title is an empty string", () => {
    expect(EventSubmitSchema.safeParse({ ...VALID, title: "" }).success).toBe(false);
  });

  it("rejects when startAt is missing", () => {
    const { startAt: _, ...rest } = VALID;
    expect(EventSubmitSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects when startAt is not a valid ISO datetime string", () => {
    expect(EventSubmitSchema.safeParse({ ...VALID, startAt: "2026-09-01" }).success).toBe(false);
  });

  it("rejects when startAt has no timezone offset", () => {
    expect(
      EventSubmitSchema.safeParse({ ...VALID, startAt: "2026-09-01T08:00:00" }).success,
    ).toBe(false);
  });

  it("rejects when eventTypeId is missing", () => {
    const { eventTypeId: _, ...rest } = VALID;
    expect(EventSubmitSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects when eventTypeId is not a UUID", () => {
    expect(EventSubmitSchema.safeParse({ ...VALID, eventTypeId: "trip" }).success).toBe(false);
  });

  it("rejects when grades array is empty (min 1)", () => {
    expect(EventSubmitSchema.safeParse({ ...VALID, grades: [] }).success).toBe(false);
  });

  it("rejects when grades array is missing", () => {
    const { grades: _, ...rest } = VALID;
    expect(EventSubmitSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a grade outside the 7–12 range", () => {
    expect(EventSubmitSchema.safeParse({ ...VALID, grades: [5, 9] }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RejectSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("RejectSchema", () => {
  it("accepts a non-empty reason string", () => {
    expect(RejectSchema.safeParse({ reason: "Dates conflict with Passover." }).success).toBe(true);
  });

  it("rejects an empty reason string", () => {
    expect(RejectSchema.safeParse({ reason: "" }).success).toBe(false);
  });

  it("rejects a reason longer than 2000 characters", () => {
    expect(RejectSchema.safeParse({ reason: "x".repeat(2001) }).success).toBe(false);
  });

  it("rejects when reason field is absent", () => {
    expect(RejectSchema.safeParse({}).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ICalSubscriptionSchema
// ─────────────────────────────────────────────────────────────────────────────

describe("ICalSubscriptionSchema", () => {
  it("accepts an empty object (no filters)", () => {
    expect(ICalSubscriptionSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid grade and event-type filters", () => {
    expect(
      ICalSubscriptionSchema.safeParse({
        grades: [7, 8],
        eventTypes: [VALID_UUID],
      }).success,
    ).toBe(true);
  });

  it("rejects a grade below 7 in the filter", () => {
    expect(ICalSubscriptionSchema.safeParse({ grades: [6] }).success).toBe(false);
  });

  it("rejects a grade above 12 in the filter", () => {
    expect(ICalSubscriptionSchema.safeParse({ grades: [13] }).success).toBe(false);
  });

  it("rejects a non-UUID in eventTypes", () => {
    expect(ICalSubscriptionSchema.safeParse({ eventTypes: ["not-a-uuid"] }).success).toBe(false);
  });

  it("rejects eventTypes array exceeding 50 entries", () => {
    const ids = Array.from({ length: 51 }, (_, i) =>
      `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    );
    expect(ICalSubscriptionSchema.safeParse({ eventTypes: ids }).success).toBe(false);
  });
});
