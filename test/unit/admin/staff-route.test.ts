import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getStaffUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getStaffUser: (...args: unknown[]) => getStaffUserMock(...args),
}));

const createStaffUserDirectMock = vi.fn();
const listStaffUsersMock = vi.fn();
vi.mock("@/lib/db/staff", () => ({
  createStaffUserDirect: (...args: unknown[]) => createStaffUserDirectMock(...args),
  listStaffUsers: (...args: unknown[]) => listStaffUsersMock(...args),
}));

const generateTempPasswordMock = vi.fn();
vi.mock("@/lib/auth/password", () => ({
  generateTempPassword: (...args: unknown[]) => generateTempPasswordMock(...args),
}));

import { POST } from "@/app/api/v1/admin/staff/route";

const ACTIVE_ADMIN = {
  id: "00000000-0000-0000-0000-0000000000a1",
  schoolId: "00000000-0000-0000-0000-00000000000a",
  role: "admin",
  status: "active",
  mustChangePassword: false,
  email: "admin@school.test",
  fullName: "School Admin",
};

const VALID_BODY = {
  email: "new-editor@school.test",
  fullName: "New Editor",
  role: "editor",
  gradeScopes: [9],
  eventTypeScopes: ["trip"],
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/admin/staff", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/v1/admin/staff", () => {
  beforeEach(() => {
    getStaffUserMock.mockReset();
    createStaffUserDirectMock.mockReset();
    listStaffUsersMock.mockReset();
    generateTempPasswordMock.mockReset();
    generateTempPasswordMock.mockReturnValue("Temp1234xy");
  });

  it("returns 401 when unauthenticated", async () => {
    getStaffUserMock.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is not an admin", async () => {
    getStaffUserMock.mockResolvedValue({ ...ACTIVE_ADMIN, role: "editor" });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(createStaffUserDirectMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the admin still has their own mustChangePassword pending", async () => {
    getStaffUserMock.mockResolvedValue({ ...ACTIVE_ADMIN, mustChangePassword: true });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
    expect(createStaffUserDirectMock).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid input", async () => {
    getStaffUserMock.mockResolvedValue(ACTIVE_ADMIN);
    const res = await POST(makeRequest({ email: "not-an-email", role: "editor" }));
    expect(res.status).toBe(400);
    expect(createStaffUserDirectMock).not.toHaveBeenCalled();
  });

  it("creates the user and returns the generated temp password once", async () => {
    getStaffUserMock.mockResolvedValue(ACTIVE_ADMIN);
    createStaffUserDirectMock.mockResolvedValue({ id: "new-staff-id" });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: "new-staff-id",
      email: "new-editor@school.test",
      temporaryPassword: "Temp1234xy",
    });
    expect(createStaffUserDirectMock).toHaveBeenCalledWith({
      schoolId: ACTIVE_ADMIN.schoolId,
      email: "new-editor@school.test",
      fullName: "New Editor",
      role: "editor",
      password: "Temp1234xy",
      gradeScopes: [9],
      eventTypeScopes: ["trip"],
    });
  });

  it("strips gradeScopes/eventTypeScopes before reaching the DB layer when role is not editor", async () => {
    getStaffUserMock.mockResolvedValue(ACTIVE_ADMIN);
    createStaffUserDirectMock.mockResolvedValue({ id: "new-staff-id" });

    const res = await POST(
      makeRequest({
        email: "new-admin@school.test",
        fullName: "New Admin",
        role: "admin",
        gradeScopes: [7, 8],
        eventTypeScopes: ["trip"],
      }),
    );

    expect(res.status).toBe(201);
    expect(createStaffUserDirectMock).toHaveBeenCalledWith({
      schoolId: ACTIVE_ADMIN.schoolId,
      email: "new-admin@school.test",
      fullName: "New Admin",
      role: "admin",
      password: "Temp1234xy",
      gradeScopes: [],
      eventTypeScopes: [],
    });
  });

  it("returns 409 duplicate_email when createStaffUserDirect reports an already-registered email", async () => {
    getStaffUserMock.mockResolvedValue(ACTIVE_ADMIN);
    createStaffUserDirectMock.mockRejectedValue(
      new Error("createUser new-editor@school.test: Email already registered"),
    );

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("duplicate_email");
  });

  it("returns 500 create_failed for any other createStaffUserDirect error", async () => {
    getStaffUserMock.mockResolvedValue(ACTIVE_ADMIN);
    createStaffUserDirectMock.mockRejectedValue(new Error("connection reset"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("create_failed");
  });
});
