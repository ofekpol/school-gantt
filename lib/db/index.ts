export { db, withSchool } from "./client";
export * as schema from "./schema";
// supabaseAdmin is intentionally NOT re-exported here.
// Import it directly from "@/lib/db/client" inside lib/db/ only (ESLint DB-04).
