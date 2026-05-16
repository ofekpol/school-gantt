import { describe, it, expect, vi, beforeEach } from "vitest";

const withSchoolMock = vi.fn();
vi.mock("@/lib/db/client", () => ({
  withSchool: (...args: unknown[]) => withSchoolMock(...args),
  db: {},
  supabaseAdmin: {},
}));

import { assertEditorScope } from "@/lib/auth/scopes";

const editor = { id: "u1", schoolId: "s1", role: "editor" as const, status: "active" as const };
const admin = { id: "u2", schoolId: "s1", role: "admin" as const, status: "active" as const };

beforeEach(() => {
  withSchoolMock.mockReset();
});

describe("AUTH-06: admins bypass scope checks", () => {
  it("admin with no grade scope: passes for any grade", async () => {
    await expect(assertEditorScope(admin, 11)).resolves.toBeUndefined();
    expect(withSchoolMock).not.toHaveBeenCalled();
  });
  it("admin with no event_type scope: passes for any eventType", async () => {
    await expect(assertEditorScope(admin, undefined, "trip")).resolves.toBeUndefined();
    expect(withSchoolMock).not.toHaveBeenCalled();
  });
});

describe("AUTH-07: viewer and inactive users are blocked", () => {
  it("viewer role → throws 403 without making DB calls", async () => {
    const viewer = { id: "u3", schoolId: "s1", role: "viewer" as const, status: "active" as const };
    await expect(assertEditorScope(viewer, 10)).rejects.toMatchObject({ status: 403 });
    expect(withSchoolMock).not.toHaveBeenCalled();
  });

  it("editor with status='pending' → throws 403", async () => {
    const pending = { id: "u4", schoolId: "s1", role: "editor" as const, status: "pending" as const };
    await expect(assertEditorScope(pending, 10)).rejects.toMatchObject({ status: 403 });
    expect(withSchoolMock).not.toHaveBeenCalled();
  });

  it("editor with status='deactivated' → throws 403", async () => {
    const deactivated = { id: "u5", schoolId: "s1", role: "editor" as const, status: "deactivated" as const };
    await expect(assertEditorScope(deactivated, 10)).rejects.toMatchObject({ status: 403 });
    expect(withSchoolMock).not.toHaveBeenCalled();
  });
});

describe("AUTH-05: assertEditorScope throws 403 on violation", () => {
  it("editor without grade scope: throws 403 when grade=11", async () => {
    // mock withSchool to invoke its callback with a tx that returns []
    withSchoolMock.mockImplementation(async (_school: unknown, fn: (tx: unknown) => unknown) =>
      fn({
        select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
      }),
    );
    await expect(assertEditorScope(editor, 11)).rejects.toMatchObject({ status: 403 });
  });

  it("editor with matching grade scope: passes", async () => {
    withSchoolMock.mockImplementation(async (_school: unknown, fn: (tx: unknown) => unknown) =>
      fn({
        select: () => ({
          from: () => ({ where: () => ({ limit: () => [{ id: "scope1" }] }) }),
        }),
      }),
    );
    await expect(assertEditorScope(editor, 10)).resolves.toBeUndefined();
  });

  it("no checks specified: passes silently", async () => {
    await expect(assertEditorScope(editor)).resolves.toBeUndefined();
    expect(withSchoolMock).not.toHaveBeenCalled();
  });

  it("editor without event_type scope: throws 403 when eventType='trip'", async () => {
    withSchoolMock.mockImplementation(async (_school: unknown, fn: (tx: unknown) => unknown) =>
      fn({
        select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
      }),
    );
    await expect(assertEditorScope(editor, undefined, "trip")).rejects.toMatchObject({
      status: 403,
    });
  });
});
