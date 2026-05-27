-- Cleanup E2E pollution from prod Supabase.
--
-- Background: integration tests historically ran against the prod DB
-- without teardown, leaving rows visible to every public viewer:
--   • events with titles starting with E2E / Approval-E2E- / Perf Bench
--     / Playwright Smoke / metro / test / kugu
--   • academic years labelled "E2E <timestamp>"
--
-- Usage (run with psql against DATABASE_URL):
--   CONFIRM=1 psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/cleanup-e2e-pollution.sql
--
-- The script is wrapped in a transaction and aborts unless CONFIRM=1 is
-- exported. Dry run by default (counts only, rolls back).

\set ON_ERROR_STOP on
\set confirm `echo $CONFIRM`

BEGIN;

-- 1. Count what will be deleted (always reported).
SELECT 'events' AS table, COUNT(*) AS rows_to_delete
FROM events
WHERE title LIKE 'E2E %'
   OR title LIKE 'Approval-E2E-%'
   OR title LIKE 'Perf Bench%'
   OR title LIKE 'Playwright Smoke%'
   OR title IN ('metro', 'test', 'kugu', 'מאורררר');

SELECT 'academic_years' AS table, COUNT(*) AS rows_to_delete
FROM academic_years
WHERE label LIKE 'E2E %';

-- 2. Delete event_grades + event_revisions for soon-to-be-deleted events
DELETE FROM event_grades
WHERE event_id IN (
  SELECT id FROM events
  WHERE title LIKE 'E2E %'
     OR title LIKE 'Approval-E2E-%'
     OR title LIKE 'Perf Bench%'
     OR title LIKE 'Playwright Smoke%'
     OR title IN ('metro', 'test', 'kugu', 'מאורררר')
);

DELETE FROM event_revisions
WHERE event_id IN (
  SELECT id FROM events
  WHERE title LIKE 'E2E %'
     OR title LIKE 'Approval-E2E-%'
     OR title LIKE 'Perf Bench%'
     OR title LIKE 'Playwright Smoke%'
     OR title IN ('metro', 'test', 'kugu', 'מאורררר')
);

-- 3. Delete the events
DELETE FROM events
WHERE title LIKE 'E2E %'
   OR title LIKE 'Approval-E2E-%'
   OR title LIKE 'Perf Bench%'
   OR title LIKE 'Playwright Smoke%'
   OR title IN ('metro', 'test', 'kugu', 'מאורררר');

-- 4. Delete the bogus academic years (only if not the active one)
DELETE FROM academic_years
WHERE label LIKE 'E2E %'
  AND id NOT IN (
    SELECT active_academic_year_id FROM schools WHERE active_academic_year_id IS NOT NULL
  );

-- 5. Commit only if CONFIRM=1 was set; otherwise roll back.
\if :{?confirm}
  \if :confirm
    COMMIT;
    \echo '✓ Cleanup committed.'
  \else
    ROLLBACK;
    \echo '↩ Dry run — set CONFIRM=1 to apply.'
  \endif
\else
  ROLLBACK;
  \echo '↩ Dry run — set CONFIRM=1 to apply.'
\endif
