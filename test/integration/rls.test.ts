import { describe, it } from "vitest";

describe("DB-02 + DB-03: withSchool sets RLS session var", () => {
  it.todo("withSchool wraps a transaction and sets app.school_id");
  it.todo("queries inside withSchool see only that school's rows");
  it.todo("queries outside withSchool see empty results (RLS active)");
});

describe("DB-05: cross-school access surfaces as 404 (empty result)", () => {
  it.todo("withSchool(schoolA) cannot read school B rows");
  it.todo("API route returns 404 not 403 when fetching cross-school resource");
});
