/**
 * Seeds a throwaway PREVIEW database: the canonical demo school (db/seed.ts)
 * plus a realistic year of events across grades 7-12, ~25% of them
 * multi-grade or whole-school, for eyeballing calendar colors.
 *
 * Auth users are NOT created here (no service-role key needed); create them
 * first with the matching ids in PREVIEW_USER_IDS, then run:
 *
 *   set -a; . ./.env.preview; set +a; pnpm tsx scripts/seed-preview.ts
 *
 * Refuses to run unless PREVIEW_DB=1 so it can never touch dev/prod by accident.
 */
import { and, eq } from "drizzle-orm";
import { withSchool } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { seedDb } from "../db/seed";

export const PREVIEW_USER_IDS: Record<string, string> = {
  "admin@demo-school.test": "11111111-0000-4000-8000-000000000001",
  "grade7@demo-school.test": "11111111-0000-4000-8000-000000000007",
  "grade8@demo-school.test": "11111111-0000-4000-8000-000000000008",
  "grade9@demo-school.test": "11111111-0000-4000-8000-000000000009",
  "grade10@demo-school.test": "11111111-0000-4000-8000-000000000010",
  "grade11@demo-school.test": "11111111-0000-4000-8000-000000000011",
  "grade12@demo-school.test": "11111111-0000-4000-8000-000000000012",
  "counselor@demo-school.test": "11111111-0000-4000-8000-000000000020",
  "viewer@demo-school.test": "11111111-0000-4000-8000-000000000030",
};

const GRADES = [7, 8, 9, 10, 11, 12];
const SUBJECTS = ["מתמטיקה", "אנגלית", "תנ״ך", "ביולוגיה", "היסטוריה", "לשון", "פיזיקה"];
const SCHOOL_WIDE = ["טקס יום הזיכרון", "יום ספורט בית ספרי", "מסיבת חנוכה", "טקס פתיחת שנה"];

interface DemoEvent {
  title: string;
  typeKey: string;
  date: string;
  days: number;
  grades: number[];
}

/** Deterministic PRNG so every preview seed looks the same. */
function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function schoolDays(year: number, month: number): string[] {
  const days: string[] = [];
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (let day = 1; day <= count; day++) {
    const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
    if (weekday <= 4) days.push(new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10));
  }
  return days;
}

function buildDemoEvents(startYear: number): DemoEvent[] {
  const rand = rng(42);
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
  const events: DemoEvent[] = [];
  for (let offset = 0; offset < 10; offset++) {
    const month = (8 + offset) % 12;
    const days = schoolDays(month >= 8 ? startYear : startYear + 1, month);
    for (const grade of GRADES) {
      events.push({ title: `מבחן ב${pick(SUBJECTS)}`, typeKey: "exam", date: pick(days), days: 1, grades: [grade] });
      if (rand() < 0.5) events.push({ title: "טיול שכבתי", typeKey: "trip", date: pick(days), days: rand() < 0.3 ? 2 : 1, grades: [grade] });
    }
    const first = 7 + Math.floor(rand() * 5);
    events.push({ title: "אסיפת הורים", typeKey: "parent_meeting", date: pick(days), days: 1, grades: [first, first + 1] });
    events.push({ title: "סדנת מניעה", typeKey: "workshop", date: pick(days), days: 1, grades: GRADES.filter((g) => g >= 10) });
    events.push({ title: pick(SCHOOL_WIDE), typeKey: "ceremony", date: pick(days), days: 1, grades: GRADES });
  }
  return events;
}

async function insertDemoEvents(schoolId: string, createdBy: string, startYear: number) {
  await withSchool(schoolId, async (tx) => {
    const types = await tx.select().from(schema.eventTypes).where(eq(schema.eventTypes.schoolId, schoolId));
    const typeId = new Map(types.map((type) => [type.key, type.id]));
    await tx.delete(schema.events).where(and(eq(schema.events.schoolId, schoolId), eq(schema.events.createdBy, createdBy)));
    for (const demo of buildDemoEvents(startYear)) {
      const start = new Date(`${demo.date}T00:00:00+03:00`);
      const end = new Date(start.getTime() + demo.days * 24 * 60 * 60 * 1000 - 60 * 1000);
      const [row] = await tx
        .insert(schema.events)
        .values({ schoolId, eventTypeId: typeId.get(demo.typeKey)!, title: demo.title, startAt: start, endAt: end, allDay: true, status: "approved", createdBy })
        .returning({ id: schema.events.id });
      await tx.insert(schema.eventGrades).values(demo.grades.map((grade) => ({ eventId: row.id, grade, schoolId })));
    }
  });
}

async function main(): Promise<void> {
  if (process.env.PREVIEW_DB !== "1") throw new Error("Refusing to run: PREVIEW_DB=1 is not set.");
  const { schoolId } = await seedDb({
    ensureStaffUserId: async (email) => {
      const id = PREVIEW_USER_IDS[email];
      if (!id) throw new Error(`No preview id for ${email}`);
      return id;
    },
  });
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  await insertDemoEvents(schoolId, PREVIEW_USER_IDS["admin@demo-school.test"], startYear);
  console.log(`[seed-preview] seeded demo school ${schoolId}`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
