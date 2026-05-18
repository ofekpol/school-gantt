import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { createStaffUserFromEmailSignup, getStaffUserByAuthId } from "@/lib/db/staff";
import { skipIfNoTestDb } from "./setup";

const EMAIL_AUTH_ID = "00000000-0000-0000-0000-bbbbbbbbbbbb";
const EMAIL = "emailsignup-test@example.com";

describe.skipIf(skipIfNoTestDb)("createStaffUserFromEmailSignup", () => {
  afterEach(async () => {
    await db.delete(schema.staffUsers).where(eq(schema.staffUsers.id, EMAIL_AUTH_ID));
  });

  it("inserts staff_users row with status active and null schoolId", async () => {
    await createStaffUserFromEmailSignup({
      authUserId: EMAIL_AUTH_ID,
      email: EMAIL,
      fullName: "Test User",
    });

    const row = await getStaffUserByAuthId(EMAIL_AUTH_ID);
    expect(row).not.toBeNull();
    expect(row?.status).toBe("active");
    expect(row?.role).toBe("editor");
    expect(row?.schoolId).toBeNull();
    expect(row?.email).toBe(EMAIL);
    expect(row?.fullName).toBe("Test User");
  });

  it("is idempotent — second call does not throw", async () => {
    await createStaffUserFromEmailSignup({
      authUserId: EMAIL_AUTH_ID,
      email: EMAIL,
      fullName: "Test User",
    });
    await expect(
      createStaffUserFromEmailSignup({
        authUserId: EMAIL_AUTH_ID,
        email: EMAIL,
        fullName: "Test User",
      }),
    ).resolves.toBeUndefined();
  });
});
