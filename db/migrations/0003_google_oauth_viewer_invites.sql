-- 1. Add viewer to role enum
ALTER TYPE "public"."role" ADD VALUE IF NOT EXISTS 'viewer';

-- 2. staff_status enum
DO $$ BEGIN
  CREATE TYPE "public"."staff_status" AS ENUM('pending', 'active', 'deactivated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add status to staff_users (default active keeps existing rows intact)
ALTER TABLE "staff_users"
  ADD COLUMN "status" "staff_status" NOT NULL DEFAULT 'active';

-- 4. Make school_id nullable (pending users have no school yet)
ALTER TABLE "staff_users"
  ALTER COLUMN "school_id" DROP NOT NULL;

-- 5. staff_invites — pre-configured invite links
CREATE TABLE "staff_invites" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "token"             uuid NOT NULL DEFAULT gen_random_uuid(),
  "school_id"         uuid NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "role"              "role" NOT NULL DEFAULT 'editor',
  "grade_scopes"      integer[] NOT NULL DEFAULT '{}',
  "event_type_scopes" text[] NOT NULL DEFAULT '{}',
  "created_by"        uuid NOT NULL REFERENCES "staff_users"("id") ON DELETE RESTRICT,
  "expires_at"        timestamptz NOT NULL,
  "used_at"           timestamptz,
  "used_by"           uuid REFERENCES "staff_users"("id"),
  "created_at"        timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "staff_invites_token_unique" UNIQUE("token")
);
ALTER TABLE "staff_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_invites" FORCE ROW LEVEL SECURITY;
CREATE POLICY "school_isolation" ON "staff_invites"
  AS PERMISSIVE FOR ALL TO public
  USING (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid)
  WITH CHECK (school_id = NULLIF(current_setting('app.school_id', TRUE), '')::uuid);
CREATE INDEX "staff_invites_school_idx" ON "staff_invites"("school_id");

-- 6. pending_registrations — no RLS, service-role only
CREATE TABLE "pending_registrations" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "auth_user_id"     uuid NOT NULL UNIQUE,
  "email"            varchar(255) NOT NULL,
  "full_name"        text NOT NULL DEFAULT '',
  "google_avatar_url" text,
  "requested_at"     timestamptz DEFAULT now() NOT NULL,
  "reviewed_at"      timestamptz,
  "reviewed_by"      uuid REFERENCES "staff_users"("id"),
  "review_outcome"   varchar(16),
  CONSTRAINT "pending_registrations_email_unique" UNIQUE("email")
);
CREATE INDEX "pending_registrations_email_idx" ON "pending_registrations"("email");
