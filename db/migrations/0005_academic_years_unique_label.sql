-- Migration 0005: Add unique constraint on academic_years(school_id, label)
-- Prevents duplicate year labels per school (e.g. from test re-seeding).
-- Safe to apply on existing data only if no duplicates exist; run the
-- de-dup step first if needed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'academic_years_school_id_label_key'
  ) THEN
    ALTER TABLE academic_years
      ADD CONSTRAINT academic_years_school_id_label_key UNIQUE (school_id, label);
  END IF;
END $$;
