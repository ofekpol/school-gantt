import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";

const withSchoolMock = vi.fn();
const createUserMock = vi.fn();
const deleteUserMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {},
  withSchool: (...args: unknown[]) => withSchoolMock(...args),
}));

vi.mock("@/lib/db/supabase-admin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        createUser: (...args: unknown[]) => createUserMock(...args),
        deleteUser: (...args: unknown[]) => deleteUserMock(...args),
      },
    },
  },
}));

import { createStaffUserDirect } from "@/lib/db/staff";

const SCHOOL = "00000000-0000-0000-0000-000000000001";
const AUTH_USER = "00000000-0000-0000-0000-000000000002";

interface InsertCall {
  table: unknown;
  rows: unknown;
}

function makeTx(insertCalls: InsertCall[]) {
  return {
    insert: (table: unknown) => ({
      values: (rows: unknown) => {
        insertCalls.push({ table, rows });
        return Promise.resolve([]);
      },
    }),
  };
}

let insertCalls: InsertCall[];

beforeEach(() => {
  withSchoolMock.mockReset();
  createUserMock.mockReset();
  deleteUserMock.mockReset();
  insertCalls = [];
  withSchoolMock.mockImplementation(async (_schoolId: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn(makeTx(insertCalls)),
  );
});

describe("createStaffUserDirect", () => {
  it("creates the auth user, then staff_users with mustChangePassword=true, then scopes", async () => {
    createUserMock.mockResolvedValue({ data: { user: { id: AUTH_USER } }, error: null });

    const result = await createStaffUserDirect({
      schoolId: SCHOOL,
      email: "new-editor@school.test",
      fullName: "New Editor",
      role: "editor",
      password: "Temp1234xy",
      gradeScopes: [9],
      eventTypeScopes: ["trip"],
    });

    expect(result).toEqual({ id: AUTH_USER });
    expect(createUserMock).toHaveBeenCalledWith({
      email: "new-editor@school.test",
      password: "Temp1234xy",
      email_confirm: true,
    });
    expect(withSchoolMock).toHaveBeenCalledWith(SCHOOL, expect.any(Function));

    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0].table).toBe(schema.staffUsers);
    expect(insertCalls[0].rows).toMatchObject({
      id: AUTH_USER,
      schoolId: SCHOOL,
      email: "new-editor@school.test",
      fullName: "New Editor",
      role: "editor",
      status: "active",
      mustChangePassword: true,
    });
    expect(insertCalls[1].table).toBe(schema.editorScopes);
    expect(insertCalls[1].rows).toEqual([
      { staffUserId: AUTH_USER, schoolId: SCHOOL, scopeKind: "grade", scopeValue: "9" },
      { staffUserId: AUTH_USER, schoolId: SCHOOL, scopeKind: "event_type", scopeValue: "trip" },
    ]);
  });

  it("does not insert scope rows when none are given", async () => {
    createUserMock.mockResolvedValue({ data: { user: { id: AUTH_USER } }, error: null });

    await createStaffUserDirect({
      schoolId: SCHOOL,
      email: "new-admin@school.test",
      fullName: "New Admin",
      role: "admin",
      password: "Temp1234xy",
    });

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe(schema.staffUsers);
  });

  it("throws without touching the DB when the email is already registered", async () => {
    createUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "Email already registered" },
    });

    await expect(
      createStaffUserDirect({
        schoolId: SCHOOL,
        email: "dupe@school.test",
        fullName: "Dupe",
        role: "editor",
        password: "Temp1234xy",
      }),
    ).rejects.toThrow(/already registered/i);

    expect(withSchoolMock).not.toHaveBeenCalled();
  });

  it("rolls back the auth user and rethrows when the DB write fails", async () => {
    createUserMock.mockResolvedValue({ data: { user: { id: AUTH_USER } }, error: null });
    withSchoolMock.mockRejectedValue(new Error("unique constraint violation"));
    deleteUserMock.mockResolvedValue({ error: null });

    await expect(
      createStaffUserDirect({
        schoolId: SCHOOL,
        email: "new-editor@school.test",
        fullName: "New Editor",
        role: "editor",
        password: "Temp1234xy",
      }),
    ).rejects.toThrow("unique constraint violation");

    expect(deleteUserMock).toHaveBeenCalledWith(AUTH_USER);
  });
});
