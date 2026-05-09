CREATE TYPE "public"."event_status" AS ENUM('draft', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."scope_kind" AS ENUM('grade', 'event_type');--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"label" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_years" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"actor_staff_id" uuid,
	"action" varchar(64) NOT NULL,
	"target_table" varchar(64) NOT NULL,
	"target_id" uuid,
	"payload" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "editor_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"scope_kind" "scope_kind" NOT NULL,
	"scope_value" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "editor_scopes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_grades" (
	"event_id" uuid NOT NULL,
	"grade" integer NOT NULL,
	"school_id" uuid NOT NULL,
	CONSTRAINT "event_grades_event_id_grade_pk" PRIMARY KEY("event_id","grade")
);
--> statement-breakpoint
ALTER TABLE "event_grades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"snapshot" jsonb NOT NULL,
	"submitted_by" uuid,
	"decided_by" uuid,
	"decision" varchar(16),
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_revisions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"label_he" text NOT NULL,
	"label_en" text NOT NULL,
	"color_hex" varchar(7) NOT NULL,
	"glyph" varchar(8) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_event_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ical_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"filter_grades" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"filter_event_types" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ical_subscriptions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "ical_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"locale" varchar(8) DEFAULT 'he' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Jerusalem' NOT NULL,
	"active_academic_year_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" text NOT NULL,
	"role" "role" DEFAULT 'editor' NOT NULL,
	"locked_until" timestamp with time zone,
	"login_attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	CONSTRAINT "staff_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "staff_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_staff_id_staff_users_id_fk" FOREIGN KEY ("actor_staff_id") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_scopes" ADD CONSTRAINT "editor_scopes_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_scopes" ADD CONSTRAINT "editor_scopes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_grades" ADD CONSTRAINT "event_grades_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_grades" ADD CONSTRAINT "event_grades_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_revisions" ADD CONSTRAINT "event_revisions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_revisions" ADD CONSTRAINT "event_revisions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_revisions" ADD CONSTRAINT "event_revisions_submitted_by_staff_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_revisions" ADD CONSTRAINT "event_revisions_decided_by_staff_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_staff_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ical_subscriptions" ADD CONSTRAINT "ical_subscriptions_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."staff_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ical_subscriptions" ADD CONSTRAINT "ical_subscriptions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_school_at_idx" ON "audit_log" USING btree ("school_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "editor_scopes_unique_idx" ON "editor_scopes" USING btree ("staff_user_id","scope_kind","scope_value");--> statement-breakpoint
CREATE INDEX "editor_scopes_staff_user_idx" ON "editor_scopes" USING btree ("staff_user_id");--> statement-breakpoint
CREATE INDEX "event_revisions_event_created_idx" ON "event_revisions" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_school_key_idx" ON "event_types" USING btree ("school_id","key");--> statement-breakpoint
CREATE INDEX "events_school_status_idx" ON "events" USING btree ("school_id","status");--> statement-breakpoint
CREATE INDEX "events_school_start_idx" ON "events" USING btree ("school_id","start_at");--> statement-breakpoint
CREATE POLICY "school_isolation" ON "academic_years" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);--> statement-breakpoint
CREATE POLICY "school_isolation" ON "audit_log" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);--> statement-breakpoint
CREATE POLICY "school_isolation" ON "editor_scopes" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);--> statement-breakpoint
CREATE POLICY "school_isolation" ON "event_grades" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);--> statement-breakpoint
CREATE POLICY "school_isolation" ON "event_revisions" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);--> statement-breakpoint
CREATE POLICY "school_isolation" ON "event_types" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);--> statement-breakpoint
CREATE POLICY "school_isolation" ON "events" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);--> statement-breakpoint
CREATE POLICY "school_isolation" ON "ical_subscriptions" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);--> statement-breakpoint
CREATE POLICY "school_isolation" ON "staff_users" AS PERMISSIVE FOR ALL TO public USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid) WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);