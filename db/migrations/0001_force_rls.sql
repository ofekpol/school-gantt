-- Force RLS on all school-scoped tables so that even the postgres superuser
-- is subject to the school_isolation policy when using withSchool().
-- Without FORCE ROW LEVEL SECURITY, bypassrls users (postgres) skip RLS entirely.
ALTER TABLE "academic_years" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "editor_scopes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_grades" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_revisions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_types" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ical_subscriptions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff_users" FORCE ROW LEVEL SECURITY;
