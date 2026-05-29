CREATE TABLE "staff_event_dismissals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "school_id" uuid NOT NULL,
  "staff_user_id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "dismissed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_event_dismissals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "staff_event_dismissals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "staff_event_dismissals" ADD CONSTRAINT "staff_event_dismissals_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_event_dismissals" ADD CONSTRAINT "staff_event_dismissals_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff_event_dismissals" ADD CONSTRAINT "staff_event_dismissals_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_event_dismissals_staff_event_idx" ON "staff_event_dismissals" USING btree ("staff_user_id","event_id");
--> statement-breakpoint
CREATE INDEX "staff_event_dismissals_school_staff_idx" ON "staff_event_dismissals" USING btree ("school_id","staff_user_id");
--> statement-breakpoint
CREATE INDEX "staff_event_dismissals_event_idx" ON "staff_event_dismissals" USING btree ("event_id");
--> statement-breakpoint
CREATE POLICY "school_isolation" ON "staff_event_dismissals" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);
