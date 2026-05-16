import { describe, it, expect } from "vitest";
import { assertAdmin } from "@/lib/auth/admin";
import type { StaffUserRecord } from "@/lib/db/staff";

function makeUser(overrides: Partial<StaffUserRecord>): StaffUserRecord {
  return {
    id: "u1",
    schoolId: "s1",
    email: "test@example.com",
    fullName: "Test User",
    role: "admin",
    status: "active",
    ...overrides,
  };
}

describe("assertAdmin", () => {
  it("null user → throws 401", () => {
    expect(() => assertAdmin(null)).toThrow();
    try {
      assertAdmin(null);
    } catch (e) {
      expect((e as Response).status).toBe(401);
    }
  });

  it("status='pending' → throws 403", () => {
    const user = makeUser({ status: "pending" });
    expect(() => assertAdmin(user)).toThrow();
    try {
      assertAdmin(user);
    } catch (e) {
      expect((e as Response).status).toBe(403);
    }
  });

  it("status='deactivated' → throws 403", () => {
    const user = makeUser({ status: "deactivated" });
    expect(() => assertAdmin(user)).toThrow();
    try {
      assertAdmin(user);
    } catch (e) {
      expect((e as Response).status).toBe(403);
    }
  });

  it("status='active', role='editor' → throws 403", () => {
    const user = makeUser({ role: "editor" });
    expect(() => assertAdmin(user)).toThrow();
    try {
      assertAdmin(user);
    } catch (e) {
      expect((e as Response).status).toBe(403);
    }
  });

  it("status='active', role='viewer' → throws 403", () => {
    const user = makeUser({ role: "viewer" });
    expect(() => assertAdmin(user)).toThrow();
    try {
      assertAdmin(user);
    } catch (e) {
      expect((e as Response).status).toBe(403);
    }
  });

  it("status='active', role='admin' → does NOT throw", () => {
    const user = makeUser({ role: "admin", status: "active" });
    expect(() => assertAdmin(user)).not.toThrow();
  });
});
