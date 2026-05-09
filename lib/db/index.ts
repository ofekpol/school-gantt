export { db } from "./client";
export * as schema from "./schema";
// The service-role client is intentionally not re-exported here.
// Import it directly from "@/lib/db/client" inside lib/db/ only (ESLint DB-04).
