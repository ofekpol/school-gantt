-- Add must_change_password flag to staff_users.
-- Seeded users and admin-created accounts start with true; cleared after first password change.
ALTER TABLE "staff_users"
  ADD COLUMN "must_change_password" boolean NOT NULL DEFAULT false;
