import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { updateStaffUser } from "@/lib/db/staff";
import { assertEditorScope } from "@/lib/auth/scopes";
import { skipIfNoTestDb, testDb, testSchoolA } from "./setup";

describe("ADMIN-01: admin manages staff users at /admin/staff", () => {
  it.todo("admin can create a new staff user (editor or admin role)");
  it.todo("admin can edit staff user fullName and role");
  it.todo(
    "admin can deactivate a staff user (sets deactivatedAt timestamp)",
  );
  it.todo("non-admin editor cannot access /admin/staff (returns 403)");
  it.todo("admin cannot create staff for a different school (RLS)");
});

describe.skipIf(skipIfNoTestDb)("ADMIN-01: staff edits update role permissions", () => {
  it("admin can edit a staff user's name, role, and scopes", async () => {
    const staffUserId = randomUUID();
    await testDb!.insert(schema.staffUsers).values({
      id: staffUserId,
      schoolId: testSchoolA,
      email: `staff-edit-${staffUserId.slice(0, 8)}@test`,
      fullName: "Original Name",
      role: "viewer",
    });

    await updateStaffUser(testSchoolA, staffUserId, {
      fullName: "Edited Name",
      role: "editor",
      gradeScopes: [10],
      eventTypeScopes: ["trip"],
    });

    const [user] = await testDb!
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.id, staffUserId));
    expect(user.fullName).toBe("Edited Name");
    expect(user.role).toBe("editor");

    const scopes = await testDb!
      .select()
      .from(schema.editorScopes)
      .where(eq(schema.editorScopes.staffUserId, staffUserId));
    expect(scopes.map((scope) => [scope.scopeKind, scope.scopeValue]).sort()).toEqual([
      ["event_type", "trip"],
      ["grade", "10"],
    ]);

    await expect(
      assertEditorScope(
        { id: staffUserId, schoolId: testSchoolA, role: "editor", status: "active" },
        10,
        "trip",
      ),
    ).resolves.toBeUndefined();
  });

  it("demoting an editor to viewer removes edit permissions and stored scopes", async () => {
    const staffUserId = randomUUID();
    await testDb!.insert(schema.staffUsers).values({
      id: staffUserId,
      schoolId: testSchoolA,
      email: `staff-demote-${staffUserId.slice(0, 8)}@test`,
      fullName: "Scoped Editor",
      role: "editor",
    });
    await testDb!.insert(schema.editorScopes).values([
      {
        staffUserId,
        schoolId: testSchoolA,
        scopeKind: "grade",
        scopeValue: "10",
      },
      {
        staffUserId,
        schoolId: testSchoolA,
        scopeKind: "event_type",
        scopeValue: "trip",
      },
    ]);

    await updateStaffUser(testSchoolA, staffUserId, { role: "viewer" });

    const [user] = await testDb!
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.id, staffUserId));
    expect(user.role).toBe("viewer");

    const scopes = await testDb!
      .select()
      .from(schema.editorScopes)
      .where(eq(schema.editorScopes.staffUserId, staffUserId));
    expect(scopes).toHaveLength(0);

    await expect(
      assertEditorScope(
        { id: staffUserId, schoolId: testSchoolA, role: "viewer", status: "active" },
        10,
        "trip",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("ADMIN-02: admin configures event types at /admin/event-types", () => {
  it.todo(
    "admin can create a new event type with labelHe, labelEn, colorHex, glyph",
  );
  it.todo("admin can edit event type label and sortOrder");
  it.todo("active editor can POST to create an event type (201)");
  it.todo("editor cannot PATCH or DELETE event-types (admin-only, 403)");
  it.todo("viewer cannot POST to event-types API (returns 403)");
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
