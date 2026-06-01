ALTER TABLE staff_invites
  ADD COLUMN IF NOT EXISTS multi_use boolean NOT NULL DEFAULT false;
