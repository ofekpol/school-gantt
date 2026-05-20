import "dotenv/config";
import { db, withSchool } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

const schoolA = "00000000-0000-0000-0000-00000000000a";
const schoolB = "00000000-0000-0000-0000-00000000000b";

async function test() {
  const rowsA = await withSchool(schoolA, async (tx) => {
    const roleRes = await tx.execute(sql`SELECT current_user`);
    console.log("Inside withSchool(A), current_user:", roleRes.rows);
    return tx.select().from(schema.eventTypes);
  });
  console.log("withSchool(A) count:", rowsA.length, "schoolIds:", rowsA.map((r) => r.schoolId));

  const rowsB = await withSchool(schoolB, (tx) => tx.select().from(schema.eventTypes));
  console.log("withSchool(B) count:", rowsB.length, "schoolIds:", rowsB.map((r) => r.schoolId));

  process.exit(0);
}

test().catch((e) => { console.error(e); process.exit(1); });
