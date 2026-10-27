/**
 * Fixed link token for the demo seed's `demo-school` (local/staging only — the
 * seed refuses prod). Public on purpose so e2e specs can open its public views;
 * real schools get a random token from migration 0017.
 */
export const DEMO_SCHOOL_ACCESS_TOKEN = "de".repeat(32);
export const DEMO_SCHOOL_PATH = `/${DEMO_SCHOOL_ACCESS_TOKEN}`;
