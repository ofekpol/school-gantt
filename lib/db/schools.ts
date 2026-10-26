import "server-only";
import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db, rethrowWithDatabaseHint } from "@/lib/db/client";
import { schools } from "@/lib/db/schema";
import { SchoolSlugSchema } from "@/lib/validations/school";

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
 * Resolves an untrusted `?school=` value (URL param, signup metadata) to a
 * school id. Anything malformed or unknown is "no school" — never an error.
 */
export async function resolveSchoolFromParam(raw: unknown): Promise<PublicSchoolRecord | null> {
  const parsed = SchoolSlugSchema.safeParse(raw);
  if (!parsed.success) return null;
  return getSchoolBySlug(parsed.data);
}

export async function resolveSchoolIdFromParam(raw: unknown): Promise<string | null> {
  return (await resolveSchoolFromParam(raw))?.id ?? null;
}

/**
 * Resolves a school by id. Used by authenticated pages where the caller
 * already has `user.schoolId` and needs the human-readable name. Cached per
 * request so the staff/admin layout header and the page share one query.
 */
export const getSchoolById = cache(resolveSchoolById);

async function resolveSchoolById(
  id: string,
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
      .where(eq(schools.id, id))
      .limit(1);
  } catch (error) {
    rethrowWithDatabaseHint(error, "Failed to load school");
  }

  return row ?? null;
}

/**
 * Lists all schools, alphabetical by name. Used by the unauthenticated
 * /schedule page: one school renders directly, several show a picker.
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
