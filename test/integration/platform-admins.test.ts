import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { isPlatformAdmin } from "@/lib/db/platform-admins";
import { testDb, skipIfNoTestDb, shouldSkip } from "./setup";

describe.skipIf(skipIfNoTestDb)("platform_admins", () => {
  const adminId = randomUUID();

  afterAll(async () => {
    if (shouldSkip()) return;
    await testDb!.delete(schema.platformAdmins).where(eq(schema.platformAdmins.authUserId, adminId));
  });

  it("is true only for auth users listed in platform_admins", async () => {
    if (shouldSkip()) return;
    await testDb!.insert(schema.platformAdmins).values({ authUserId: adminId });
    expect(await isPlatformAdmin(adminId)).toBe(true);
    expect(await isPlatformAdmin(randomUUID())).toBe(false);
  });
});
