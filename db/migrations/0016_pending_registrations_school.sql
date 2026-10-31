-- A pending registration belongs to the school whose sign-up link was used.
-- NULL = signed up without a school link; no admin sees it.
ALTER TABLE pending_registrations ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
-- Backfill only while the deployment is single-school (prod today); ambiguous otherwise.
UPDATE pending_registrations SET school_id = (SELECT id FROM schools)
  WHERE school_id IS NULL AND (SELECT count(*) FROM schools) = 1;
CREATE INDEX IF NOT EXISTS pending_registrations_open_by_school
  ON pending_registrations (school_id) WHERE review_outcome IS NULL;
