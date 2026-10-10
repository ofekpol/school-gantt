-- Re-anchor event times to Asia/Jerusalem wall clock.
--
-- Until this release every editor path (wizard, quick-event dialog, edit
-- drawer) stamped the typed wall-clock time with a fixed +02:00 offset. On
-- summer-time (+03:00) dates that stored timed events one hour late
-- ("13:00–14:00" displayed as 14:00–15:00) and all-day events as
-- 01:00 → 00:59:59 of the next day.
--
-- The typed wall clock is the +02:00 reading of the stored instant; rewrite
-- it as the same wall clock in Asia/Jerusalem (DST-aware). Winter-time rows
-- are unchanged by construction. 'Etc/GMT-2' is POSIX notation for UTC+2.
--
-- Not idempotent on its own — the migration runner applies it exactly once.
-- Original values are kept in events_tz_backup_0013 for rollback.

CREATE TABLE events_tz_backup_0013 AS
  SELECT id, start_at, end_at FROM events;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE events_tz_backup_0013 FROM "anon"';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE events_tz_backup_0013 FROM "authenticated"';
  END IF;
END $$;

UPDATE events
SET
  start_at = (start_at AT TIME ZONE 'Etc/GMT-2') AT TIME ZONE 'Asia/Jerusalem',
  end_at   = (end_at   AT TIME ZONE 'Etc/GMT-2') AT TIME ZONE 'Asia/Jerusalem'
WHERE (start_at AT TIME ZONE 'Etc/GMT-2') <> (start_at AT TIME ZONE 'Asia/Jerusalem')
   OR (end_at   AT TIME ZONE 'Etc/GMT-2') <> (end_at   AT TIME ZONE 'Asia/Jerusalem');

-- Fail (and roll back) if any all-day row is still off local midnight — e.g.
-- if RLS hid rows from the migrating role.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM events
    WHERE all_day
      AND ((start_at AT TIME ZONE 'Asia/Jerusalem')::time <> '00:00:00'
        OR (end_at AT TIME ZONE 'Asia/Jerusalem')::time <> '23:59:59')
  ) THEN
    RAISE EXCEPTION '0013: all-day events not re-anchored to Asia/Jerusalem midnight';
  END IF;
END $$;
