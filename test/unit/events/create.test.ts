import { describe, it } from "vitest";

describe("createDraftEvent: creates a draft event row", () => {
  it.todo("returns an event with status=draft");
  it.todo("sets version=1 on initial create");
  it.todo("sets schoolId from the authenticated user's school");
  it.todo("sets createdBy from the authenticated user id");
});

describe("updateEventStep: autosaves a wizard step", () => {
  it.todo("updates only the fields provided (partial update)");
  it.todo("increments version on each successful update");
  it.todo("throws if event belongs to a different school (RLS)");
  it.todo("throws if event is not in draft status");
});

describe("submitEvent: transitions draft to pending", () => {
  it.todo("changes status from draft to pending");
  it.todo(
    "validates all required wizard fields are present before submitting",
  );
  it.todo("writes an event_revisions row on submit");
  it.todo("throws if event is already pending or approved");
});

describe("softDeleteEvent: marks event as deleted", () => {
  it.todo("sets deletedAt timestamp on the event");
  it.todo("throws if event is pending or approved (can only delete drafts)");
  it.todo("throws if caller is not the event creator (unless admin)");
});
