// NOTE: no `import "server-only"` — this module is invoked by scripts/ban-deactivated-staff.ts
// via tsx outside the Next.js server runtime.
import { eq } from "drizzle-orm";
import { db, supabaseAdmin } from "./client";
import { staffUsers } from "./schema";

// ~100 years; GoTrue has no "forever" ban.
export const DEACTIVATED_BAN_DURATION = "876000h";

export interface BanResult {
  banned: string[];
  failed: Array<{ id: string; reason: string }>;
}

/** Bans the auth user of every deactivated staff row. Safe to re-run. Keeps going past failures. */
export async function banDeactivatedStaff(): Promise<BanResult> {
  const rows = await db
    .select({ id: staffUsers.id })
    .from(staffUsers)
    .where(eq(staffUsers.status, "deactivated"));

  const banned: string[] = [];
  const failed: BanResult["failed"] = [];
  for (const { id } of rows) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: DEACTIVATED_BAN_DURATION,
    });
    if (error) failed.push({ id, reason: error.message });
    else banned.push(id);
  }
  return { banned, failed };
}
