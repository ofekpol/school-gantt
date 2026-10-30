import { config } from "dotenv";
config({ path: ".env.local", override: false, quiet: true });
config({ override: false, quiet: true });

import { banDeactivatedStaff } from "@/lib/db/ban-deactivated";

/**
 * One-time backfill: bans staff who were deactivated before deactivation applied a ban.
 * Run it only where the app already lifts the ban on reactivation, or a reactivated
 * user stays locked out.
 *
 *   pnpm tsx scripts/ban-deactivated-staff.ts
 *
 * Point NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL at the target first.
 */
async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  console.log(`Target: ${new URL(url).hostname}`);

  const { banned, failed } = await banDeactivatedStaff();
  console.log(`Banned ${banned.length}, failed ${failed.length}`);
  for (const { id, reason } of failed) console.error(`  ${id}: ${reason}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
