CREATE INDEX IF NOT EXISTS "events_public_filter_idx"
  ON "events" ("school_id", "status", "deleted_at", "start_at");

CREATE INDEX IF NOT EXISTS "event_grades_school_grade_event_idx"
  ON "event_grades" ("school_id", "grade", "event_id");

CREATE INDEX IF NOT EXISTS "event_revisions_event_decision_idx"
  ON "event_revisions" ("event_id", "decision");
