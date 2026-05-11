import { describe, it } from "vitest";
import { skipIfNoTestDb } from "./setup";

describe("Events API — RLS and auth boundaries", () => {
  it.todo("unauthenticated POST /api/v1/events returns 401");
  it.todo("editor from school A cannot PATCH event from school B (returns 404)");
  it.todo("admin can PATCH any event in their school");
});

describe("Events API — response shape", () => {
  it.todo("POST /api/v1/events returns camelCase event object (not snake_case)");
  it.todo("event object includes id, schoolId, status, version, createdAt");
  it.todo("event_grades join is included as grades array in event response");
});

describe("Events API — validation", () => {
  it.todo("POST with missing required fields returns 422 with field errors");
  it.todo("POST with title longer than 120 chars returns 422");
  it.todo("POST with empty grades array returns 422");
  it.todo("POST with endAt before startAt returns 422");
});

// Suppress unused-import warning — skipIfNoTestDb used by individual tests in implementation
void skipIfNoTestDb;
