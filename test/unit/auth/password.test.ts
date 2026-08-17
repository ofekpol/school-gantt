import { describe, it, expect } from "vitest";
import { generateTempPassword } from "@/lib/auth/password";

const ALLOWED_CHARS = /^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789]+$/;

describe("generateTempPassword", () => {
  it("defaults to length 10", () => {
    expect(generateTempPassword()).toHaveLength(10);
  });

  it("respects a custom length", () => {
    expect(generateTempPassword(14)).toHaveLength(14);
  });

  it("only uses unambiguous charset characters", () => {
    const password = generateTempPassword(50);
    expect(password).toMatch(ALLOWED_CHARS);
  });

  it("never contains ambiguous characters 0, O, 1, l, I", () => {
    const password = generateTempPassword(200);
    expect(password).not.toMatch(/[0O1lI]/);
  });

  it("always contains at least one uppercase letter, one lowercase letter, and one digit", () => {
    for (let i = 0; i < 50; i++) {
      const password = generateTempPassword();
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
    }
  });

  it("generates distinct passwords across many calls", () => {
    const passwords = Array.from({ length: 500 }, () => generateTempPassword());
    expect(new Set(passwords).size).toBe(passwords.length);
  });
});
