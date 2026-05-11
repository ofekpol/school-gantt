import { describe, it } from "vitest";
import { skipIfNoTestDb } from "./setup";

describe("ADMIN-01: admin manages staff users at /admin/staff", () => {
  it.todo("admin can create a new staff user (editor or admin role)");
  it.todo("admin can edit staff user fullName and role");
  it.todo(
    "admin can deactivate a staff user (sets deactivatedAt timestamp)",
  );
  it.todo("non-admin editor cannot access /admin/staff (returns 403)");
  it.todo("admin cannot create staff for a different school (RLS)");
});

describe("ADMIN-02: admin configures event types at /admin/event-types", () => {
  it.todo(
    "admin can create a new event type with labelHe, labelEn, colorHex, glyph",
  );
  it.todo("admin can edit event type label and sortOrder");
  it.todo("non-admin cannot POST to event-types API (returns 403)");
  it.todo("event type key must be unique per school");
});

describe("ADMIN-03: admin configures active academic year at /admin/year", () => {
  it.todo(
    "admin can create an academic year with label, startDate, endDate",
  );
  it.todo(
    "admin can set a year as the active academic year for the school",
  );
  it.todo(
    "wizard date picker uses active academic year bounds for validation",
  );
  it.todo("non-admin cannot modify academic year (returns 403)");
  it.todo("academic year endDate must be after startDate");
});

// Suppress unused-import warning — skipIfNoTestDb used by individual tests in implementation
void skipIfNoTestDb;
