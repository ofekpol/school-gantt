-- Invites no longer expire; admins revoke explicitly. expires_at is kept (nullable) and unused.
ALTER TABLE staff_invites ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
ALTER TABLE staff_invites ALTER COLUMN expires_at DROP NOT NULL;
-- Unused invites already past expiry (expired or revoked, indistinguishable) stay dead.
UPDATE staff_invites SET revoked_at = expires_at WHERE used_at IS NULL AND expires_at <= now();
