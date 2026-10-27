import { z } from "zod";

/** URL slug of a school (tenant): an internal, guessable name — never an access key. */
export const SchoolSlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "slug must match ^[a-z0-9-]+$");

/**
 * Secret per-school link token (`schools.access_token`): keys `/<token>` public
 * views and `?school=<token>` sign-up links. Slugs are guessable, so they never are.
 */
export const SchoolAccessTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);
