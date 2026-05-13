/**
 * Perf seed — fans out 1 000 approved events across the active academic
 * year for the demo school. Used by the Gantt 2 s / iCal 500 ms perf
 * checks.
 *
 * Run: `pnpm seed:perf` (requires DATABASE_URL + the base seed to have
 * created the school + admin + event types).
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, withSchool } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

const EVENT_COUNT = Number(process.env.PERF_EVENT_COUNT ?? 1000);

async function main() {
  const [school] = await db
    .select()
    .from(schema.schools)
    .where(eq(schema.schools.slug, "demo-school"))
    .limit(1);
  if (!school) {
    throw new Error("Run `pnpm seed` first — demo-school not found");
  }

  // Need an active academic year to bound the date range.
  const yearId = school.activeAcademicYearId;
  if (!yearId) {
    throw new Error("Active academic year not set for demo-school");
  }
  const [year] = await withSchool(school.id, (tx) =>
    tx
      .select()
      .from(schema.academicYears)
      .where(eq(schema.academicYears.id, yearId))
      .limit(1),
  );
  if (!year) throw new Error("Active academic year row missing");

  // Pick any admin (auto-approval path requires one).
  const [admin] = await withSchool(school.id, (tx) =>
    tx
      .select()
      .from(schema.staffUsers)
      .where(eq(schema.staffUsers.role, "admin"))
      .limit(1),
  );
  if (!admin) throw new Error("No admin user found");

  const eventTypes = await withSchool(school.id, (tx) =>
    tx.select().from(schema.eventTypes),
  );
  if (eventTypes.length === 0) throw new Error("No event types — run base seed");

  const yearStartMs = new Date(year.startDate).getTime();
  const yearEndMs = new Date(year.endDate).getTime();
  const span = yearEndMs - yearStartMs;
  const grades = [7, 8, 9, 10, 11, 12];

  console.log(`Seeding ${EVENT_COUNT} approved events for ${school.slug}…`);
  const t0 = Date.now();

  await withSchool(school.id, async (tx) => {
    const rows: (typeof schema.events.$inferInsert)[] = [];
    for (let i = 0; i < EVENT_COUNT; i++) {
      const type = eventTypes[i % eventTypes.length];
      const startMs = yearStartMs + Math.floor((span / EVENT_COUNT) * i);
      const endMs = startMs + 90 * 60 * 1000; // 90 min duration
      rows.push({
        schoolId: school.id,
        eventTypeId: type.id,
        title: `Perf event #${i + 1}`,
        description: i % 11 === 0 ? "Auto-seeded for perf benchmark" : null,
        location: i % 7 === 0 ? "Main hall" : null,
        startAt: new Date(startMs),
        endAt: new Date(endMs),
        allDay: false,
        status: "approved",
        version: 1,
        createdBy: admin.id,
      });
    }
    const inserted = await tx
      .insert(schema.events)
      .values(rows)
      .returning({ id: schema.events.id });

    const gradeRows = inserted.flatMap((ev, i) => {
      // Single-grade for most, multi-grade for every 13th event.
      const target = i % 13 === 0 ? grades.slice(0, 2 + (i % 3)) : [grades[i % grades.length]];
      return target.map((g) => ({ eventId: ev.id, grade: g, schoolId: school.id }));
    });
    for (let i = 0; i < gradeRows.length; i += 500) {
      await tx.insert(schema.eventGrades).values(gradeRows.slice(i, i + 500));
    }
  });

  console.log(`Done in ${Date.now() - t0} ms.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
