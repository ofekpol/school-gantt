import { describe, it } from "vitest";

describe("createEventSchema: Zod validation for POST /api/v1/events", () => {
  it.todo("rejects missing schoolId");
  it.todo("rejects title shorter than 1 char");
  it.todo("rejects title longer than 120 chars");
  it.todo("rejects empty grades array");
  it.todo("rejects endAt before or equal to startAt");
  it.todo("accepts valid minimal event payload");
});

describe("updateEventStepSchema: Zod validation for PATCH /api/v1/events/:id", () => {
  it.todo("accepts partial updates (only step-relevant fields provided)");
  it.todo("rejects title longer than 120 chars when present");
  it.todo("rejects description longer than 2000 chars when present");
  it.todo("rejects endAt before startAt when both are provided");
  it.todo("accepts allDay=true without startAt/endAt time components");
});

describe("submitEventSchema: Zod validation for POST /api/v1/events/:id/submit", () => {
  it.todo("requires title, startAt, endAt, at least one grade, and eventTypeId");
  it.todo("rejects if startAt is not a valid ISO datetime string");
  it.todo("rejects if grades array is empty");
});
