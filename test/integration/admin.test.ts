import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  createEventType,
  updateEventType,
  deleteEventType,
  listEventTypes,
} from "@/lib/admin/event-types";
import {
  createAcademicYear,
  updateAcademicYear,
  listAcademicYears,
} from "@/lib/admin/years";
import {
  createStaffUserFromInvite,
  updateStaffUser,
  listStaffUsers,
} from "@/lib/db/staff";
import { testDb, skipIfNoTestDb, shouldSkip, testSchoolA, testSchoolB } from "./setup";

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-01: Staff management
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)(
  "ADMIN-01: admin manages staff users",
  () => {
    let staffId: string;
    let staffBId: string;

    beforeAll(async () => {
      if (shouldSkip()) return;
      staffId = randomUUID();
      await createStaffUserFromInvite({
        authUserId: staffId,
        schoolId: testSchoolA,
        email: `admin01-editor-${staffId}@test`,
        fullName: "Initial Name",
        role: "editor",
      });
      // Staff user in school B (to verify cross-school isolation)
      staffBId = randomUUID();
      await createStaffUserFromInvite({
        authUserId: staffBId,
        schoolId: testSchoolB,
        email: `admin01-editor-b-${staffBId}@test`,
        fullName: "School B Editor",
        role: "editor",
      });
    });

    it("createStaffUserFromInvite creates a user with the correct role", async () => {
      const [row] = await testDb!
        .select({ role: schema.staffUsers.role })
        .from(schema.staffUsers)
        .where(eq(schema.staffUsers.id, staffId));
      expect(row.role).toBe("editor");
    });

    it("createStaffUserFromInvite can create an admin-role user", async () => {
      const adminId = randomUUID();
      await createStaffUserFromInvite({
        authUserId: adminId,
        schoolId: testSchoolA,
        email: `admin01-admin-${adminId}@test`,
        fullName: "Test Admin",
        role: "admin",
      });
      const [row] = await testDb!
        .select({ role: schema.staffUsers.role })
        .from(schema.staffUsers)
        .where(eq(schema.staffUsers.id, adminId));
      expect(row.role).toBe("admin");
    });

    it("listStaffUsers includes the created staff member", async () => {
      const users = await listStaffUsers(testSchoolA);
      expect(users.map((u) => u.id)).toContain(staffId);
    });

    it("updateStaffUser updates fullName", async () => {
      await updateStaffUser(testSchoolA, staffId, { fullName: "Updated Name" });
      const [row] = await testDb!
        .select({ fullName: schema.staffUsers.fullName })
        .from(schema.staffUsers)
        .where(eq(schema.staffUsers.id, staffId));
      expect(row.fullName).toBe("Updated Name");
    });

    it("updateStaffUser updates role from editor to admin", async () => {
      await updateStaffUser(testSchoolA, staffId, { role: "admin" });
      const [row] = await testDb!
        .select({ role: schema.staffUsers.role })
        .from(schema.staffUsers)
        .where(eq(schema.staffUsers.id, staffId));
      expect(row.role).toBe("admin");
    });

    it("listStaffUsers does not include staff from another school", async () => {
      const users = await listStaffUsers(testSchoolA);
      expect(users.map((u) => u.id)).not.toContain(staffBId);
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-02: Event-type CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)(
  "ADMIN-02: admin configures event types",
  () => {
    let etId: string;
    const uniqueKey = `test-et-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      if (shouldSkip()) return;
      const result = await createEventType(testSchoolA, {
        key: uniqueKey,
        labelHe: "בדיקה",
        labelEn: "Test",
        colorHex: "#123456",
        glyph: "X",
        sortOrder: 99,
      });
      etId = result.id;
    });

    it("createEventType returns a valid id", async () => {
      expect(typeof etId).toBe("string");
      expect(etId.length).toBeGreaterThan(0);
    });

    it("createEventType persists the row with correct fields", async () => {
      const [row] = await testDb!
        .select()
        .from(schema.eventTypes)
        .where(eq(schema.eventTypes.id, etId));
      expect(row.key).toBe(uniqueKey);
      expect(row.labelHe).toBe("בדיקה");
      expect(row.labelEn).toBe("Test");
      expect(row.colorHex).toBe("#123456");
      expect(row.glyph).toBe("X");
    });

    it("updateEventType updates labelHe and sortOrder, returns {updated: true}", async () => {
      const result = await updateEventType(testSchoolA, etId, {
        labelHe: "עדכון",
        sortOrder: 50,
      });
      expect(result).toEqual({ updated: true });
      const [row] = await testDb!
        .select({ labelHe: schema.eventTypes.labelHe, sortOrder: schema.eventTypes.sortOrder })
        .from(schema.eventTypes)
        .where(eq(schema.eventTypes.id, etId));
      expect(row.labelHe).toBe("עדכון");
      expect(row.sortOrder).toBe(50);
    });

    it("updateEventType on a non-existent id returns {updated: false}", async () => {
      const result = await updateEventType(testSchoolA, randomUUID(), { labelEn: "Ghost" });
      expect(result).toEqual({ updated: false });
    });

    it("listEventTypes returns school A's types ordered by sortOrder", async () => {
      const types = await listEventTypes(testSchoolA);
      expect(types.length).toBeGreaterThan(0);
      // Sorted by sortOrder ascending
      for (let i = 1; i < types.length; i++) {
        expect(types[i].sortOrder).toBeGreaterThanOrEqual(types[i - 1].sortOrder);
      }
    });

    it("cross-school: updateEventType from school A on school B's event type returns {updated: false}", async () => {
      const [schoolBType] = await testDb!
        .select({ id: schema.eventTypes.id })
        .from(schema.eventTypes)
        .where(eq(schema.eventTypes.schoolId, testSchoolB))
        .limit(1);
      const result = await updateEventType(testSchoolA, schoolBType.id, { labelEn: "Hack" });
      expect(result).toEqual({ updated: false });
    });

    it("cross-school: deleteEventType from school A on school B's event type returns {deleted: false}", async () => {
      const [schoolBType] = await testDb!
        .select({ id: schema.eventTypes.id })
        .from(schema.eventTypes)
        .where(eq(schema.eventTypes.schoolId, testSchoolB))
        .limit(1);
      const result = await deleteEventType(testSchoolA, schoolBType.id);
      expect(result).toEqual({ deleted: false });
    });

    it("event type key must be unique per school — duplicate key throws", async () => {
      await expect(
        createEventType(testSchoolA, {
          key: uniqueKey, // same key as the one created in beforeAll
          labelHe: "כפול",
          labelEn: "Duplicate",
          colorHex: "#ffffff",
          glyph: "D",
        }),
      ).rejects.toThrow();
    });

    it("deleteEventType returns {deleted: true} and removes the row", async () => {
      const { id } = await createEventType(testSchoolA, {
        key: `del-${randomUUID().slice(0, 8)}`,
        labelHe: "למחיקה",
        labelEn: "To Delete",
        colorHex: "#abcdef",
        glyph: "Z",
      });
      expect(await deleteEventType(testSchoolA, id)).toEqual({ deleted: true });
      expect(await deleteEventType(testSchoolA, id)).toEqual({ deleted: false });
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-03: Academic year CRUD
// ─────────────────────────────────────────────────────────────────────────────

describe.skipIf(skipIfNoTestDb)(
  "ADMIN-03: admin configures academic years",
  () => {
    let yearId: string;
    const labelSuffix = randomUUID().slice(0, 8);

    beforeAll(async () => {
      if (shouldSkip()) return;
      const result = await createAcademicYear(testSchoolA, {
        label: `2030-${labelSuffix}`,
        startDate: "2030-09-01",
        endDate: "2031-07-31",
      });
      yearId = result.id;
    });

    it("createAcademicYear returns a valid id", async () => {
      expect(typeof yearId).toBe("string");
      expect(yearId.length).toBeGreaterThan(0);
    });

    it("createAcademicYear persists the row with correct fields", async () => {
      const [row] = await testDb!
        .select()
        .from(schema.academicYears)
        .where(eq(schema.academicYears.id, yearId));
      expect(row.label).toBe(`2030-${labelSuffix}`);
      expect(row.startDate).toBe("2030-09-01");
      expect(row.endDate).toBe("2031-07-31");
      expect(row.schoolId).toBe(testSchoolA);
    });

    it("createAcademicYear with setActive=true sets the school's active year", async () => {
      const activeSuffix = randomUUID().slice(0, 8);
      const { id } = await createAcademicYear(testSchoolA, {
        label: `2031-${activeSuffix}`,
        startDate: "2031-09-01",
        endDate: "2032-07-31",
        setActive: true,
      });
      const [school] = await testDb!
        .select({ activeAcademicYearId: schema.schools.activeAcademicYearId })
        .from(schema.schools)
        .where(eq(schema.schools.id, testSchoolA));
      expect(school.activeAcademicYearId).toBe(id);
    });

    it("updateAcademicYear updates label and endDate, returns {updated: true}", async () => {
      const newLabel = `2030-updated-${labelSuffix}`;
      const result = await updateAcademicYear(testSchoolA, yearId, {
        label: newLabel,
        endDate: "2031-08-31",
      });
      expect(result).toEqual({ updated: true });
      const [row] = await testDb!
        .select({ label: schema.academicYears.label, endDate: schema.academicYears.endDate })
        .from(schema.academicYears)
        .where(eq(schema.academicYears.id, yearId));
      expect(row.label).toBe(newLabel);
      expect(row.endDate).toBe("2031-08-31");
    });

    it("updateAcademicYear with only setActive=true sets the active year without modifying other fields", async () => {
      const result = await updateAcademicYear(testSchoolA, yearId, { setActive: true });
      expect(result).toEqual({ updated: true });
      const [school] = await testDb!
        .select({ activeAcademicYearId: schema.schools.activeAcademicYearId })
        .from(schema.schools)
        .where(eq(schema.schools.id, testSchoolA));
      expect(school.activeAcademicYearId).toBe(yearId);
    });

    it("updateAcademicYear on a non-existent id returns {updated: false}", async () => {
      const result = await updateAcademicYear(testSchoolA, randomUUID(), { label: "Ghost" });
      expect(result).toEqual({ updated: false });
    });

    it("updateAcademicYear setActive-only on a non-existent id returns {updated: false}", async () => {
      const result = await updateAcademicYear(testSchoolA, randomUUID(), { setActive: true });
      expect(result).toEqual({ updated: false });
    });

    it("listAcademicYears returns years sorted by startDate descending", async () => {
      // Create a second year to verify sort order
      const sortSuffix = randomUUID().slice(0, 8);
      await createAcademicYear(testSchoolA, {
        label: `2028-${sortSuffix}`,
        startDate: "2028-09-01",
        endDate: "2029-07-31",
      });
      const years = await listAcademicYears(testSchoolA);
      expect(years.length).toBeGreaterThan(1);
      for (let i = 1; i < years.length; i++) {
        expect(years[i].startDate <= years[i - 1].startDate).toBe(true);
      }
    });

    it("cross-school: updateAcademicYear from school A on school B's year returns {updated: false}", async () => {
      const schoolBSuffix = randomUUID().slice(0, 8);
      const { id: schoolBYearId } = await createAcademicYear(testSchoolB, {
        label: `2032-${schoolBSuffix}`,
        startDate: "2032-09-01",
        endDate: "2033-07-31",
      });
      const result = await updateAcademicYear(testSchoolA, schoolBYearId, { label: "Hack" });
      expect(result).toEqual({ updated: false });
    });
  },
);
