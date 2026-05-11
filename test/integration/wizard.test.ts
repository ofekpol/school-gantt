import { describe, it } from "vitest";
import { skipIfNoTestDb } from "./setup";

describe("WIZARD-01: staff editor creates event via 7-step wizard", () => {
  it.todo("POST /api/v1/events creates draft event row with status=draft");
  it.todo("draft row is created immediately on wizard open");
  it.todo("created draft belongs to the authenticated editor's school");
});

describe("WIZARD-02: wizard autosaves draft on every step", () => {
  it.todo("PATCH /api/v1/events/:id with step data updates the draft");
  it.todo("partial step data (step 1 only) is persisted without error");
  it.todo("autosave returns the updated event version number");
});

describe("WIZARD-03: editor can resume draft from /dashboard", () => {
  it.todo("GET /api/v1/events?status=draft returns editor's incomplete drafts");
  it.todo("resumed draft contains all previously saved step data");
  it.todo("draft persists across sessions for at least 7 days");
});

describe("WIZARD-04: date picker bounded by active academic year", () => {
  it.todo("PATCH with startAt before academic year start_date returns 422");
  it.todo("PATCH with startAt after academic year end_date returns 422");
  it.todo("PATCH with startAt within academic year boundaries succeeds");
});

describe("WIZARD-05: grade multi-select respects editor scope", () => {
  it.todo("editor with grade=10 scope can select grade 10");
  it.todo("editor with grade=10 scope cannot select grade 11 (returns 403)");
  it.todo("admin can select any grade without scope restriction");
});

describe("WIZARD-06: Step 7 submit flips status draft to pending", () => {
  it.todo(
    "POST /api/v1/events/:id/submit changes status from draft to pending",
  );
  it.todo("submit writes a row to event_revisions with decision=null");
  it.todo("submitted event is not visible on public views (status=pending)");
});

describe("WIZARD-07: dashboard shows editor's events by status", () => {
  it.todo(
    "GET /api/v1/events returns draft and pending events for the editor",
  );
  it.todo("events are filterable by status field");
  it.todo("editor cannot see other editors' events");
});

describe("WIZARD-08: editor can soft-delete their own draft events", () => {
  it.todo("DELETE /api/v1/events/:id sets deleted_at (soft delete)");
  it.todo("soft-deleted event does not appear in GET /api/v1/events");
  it.todo("editor cannot delete another editor's event (returns 403)");
  it.todo("editor cannot delete a pending or approved event");
});

describe("WIZARD-09: concurrent edit version conflict detection", () => {
  it.todo("PATCH with stale If-Match version returns 409 Conflict");
  it.todo(
    "PATCH with matching If-Match version succeeds and increments version",
  );
  it.todo("409 response includes current version so client can warn user");
});

// Suppress unused-import warning — skipIfNoTestDb used by individual tests in implementation
void skipIfNoTestDb;
