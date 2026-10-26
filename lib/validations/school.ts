import { z } from "zod";

/** URL slug of a school (tenant): `/<slug>` public views and `?school=<slug>` sign-up links. */
export const SchoolSlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "slug must match ^[a-z0-9-]+$");
