import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("Drizzle migrations journal", () => {
  it("tracks every SQL migration file so db:migrate applies schema changes", () => {
    const migrationsDir = join(process.cwd(), "db", "migrations");
    const journalPath = join(migrationsDir, "meta", "_journal.json");
    const migrationTags = readdirSync(migrationsDir)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .map((file) => file.replace(/\.sql$/, ""))
      .sort();
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ tag: string }>;
    };
    const journalTags = journal.entries.map((entry) => entry.tag).sort();

    expect(journalTags).toEqual(migrationTags);
  });
});
