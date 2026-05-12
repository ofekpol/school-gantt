-- Migration 0002: Add FK constraint from schools.active_academic_year_id → academic_years.id
-- This prevents orphan references when an academic year is deleted.
-- The constraint is DEFERRABLE INITIALLY DEFERRED so the seed script can insert the school
-- and the year in the same transaction and set active_academic_year_id afterward.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_active_academic_year_id_fkey'
  ) THEN
    ALTER TABLE schools
      ADD CONSTRAINT schools_active_academic_year_id_fkey
        FOREIGN KEY (active_academic_year_id)
        REFERENCES academic_years(id)
        ON DELETE SET NULL
        DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
