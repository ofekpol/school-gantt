import "server-only";
import { eq } from "drizzle-orm";
import { db, rethrowWithDatabaseHint } from "@/lib/db/client";
import { platformAdmins } from "@/lib/db/schema";

/**
 * True when this Supabase Auth user may provision schools. `platform_admins`
 * is not tenant data, so this reads without `withSchool`.
 */
export async function isPlatformAdmin(authUserId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ authUserId: platformAdmins.authUserId })
      .from(platformAdmins)
      .where(eq(platformAdmins.authUserId, authUserId))
      .limit(1);
    return rows.length > 0;
  } catch (error) {
    rethrowWithDatabaseHint(error, "Failed to check platform admin");
  }
}
