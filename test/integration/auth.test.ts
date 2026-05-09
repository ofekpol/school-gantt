import { describe, it } from "vitest";

describe("AUTH-01: staff user can log in with email + password", () => {
  it.todo("POST /api/v1/auth/login with valid credentials returns 200 + session cookie");
  it.todo("POST /api/v1/auth/login with wrong password returns 401");
});

describe("AUTH-03: account locks after 10 failed attempts in 15 minutes", () => {
  it.todo("10 consecutive failed logins set staff_users.locked_until");
  it.todo("11th attempt returns 423 Locked even with correct password");
  it.todo("successful login resets login_attempts to 0");
});
