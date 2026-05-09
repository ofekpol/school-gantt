import { describe, it } from "vitest";

describe("DB-06: seed script creates canonical bootstrap data", () => {
  it.todo("creates exactly one school with slug 'demo-school'");
  it.todo("creates one admin staff_user with role='admin'");
  it.todo("creates six grade-supervisor editors (grades 7-12) with editor_scopes");
  it.todo("creates one counselor editor with event_type scope");
  it.todo("creates 11 default event_types");
  it.todo("re-running seed does not duplicate any rows");
});
