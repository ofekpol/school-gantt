import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, rethrowWithDatabaseHint } from "@/lib/db/client";
import { schools } from "@/lib/db/schema";

export interface PublicSchoolRecord {
  id: string;
  slug: string;
  name: string;
  locale: string;
  timezone: string;
}

/**
 * Resolves a school by URL slug. The `schools` table has no RLS (it is the
 * tenant root), so this is the one place we can read without `withSchool` —
 * because we need the school_id *before* we can scope subsequent queries.
 *
 * Lives in `lib/db/` per CLAUDE.md "Multi-Tenancy (Critical)" — the
 * unrestricted `db` client must only be imported inside this directory.
 */
export async function getSchoolBySlug(
  slug: string,
): Promise<PublicSchoolRecord | null> {
  let row: PublicSchoolRecord | undefined;
  try {
    [row] = await db
      .select({
        id: schools.id,
        slug: schools.slug,
        name: schools.name,
        locale: schools.locale,
        timezone: schools.timezone,
      })
      .from(schools)
      .where(eq(schools.slug, slug))
      .limit(1);
  } catch (error) {
    rethrowWithDatabaseHint(error, "Failed to load school");
  }

  return row ?? null;
}

/**
 * Lists all schools, alphabetical by name. Used by the root landing page (`/`)
 * so unauthenticated visitors can pick a school.
 */
export async function listSchools(): Promise<PublicSchoolRecord[]> {
  try {
    return await db
      .select({
        id: schools.id,
        slug: schools.slug,
        name: schools.name,
        locale: schools.locale,
        timezone: schools.timezone,
      })
      .from(schools)
      .orderBy(asc(schools.name));
  } catch (error) {
    rethrowWithDatabaseHint(error, "Failed to list schools");
  }
}
