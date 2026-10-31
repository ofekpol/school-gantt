-- Unguessable per-school link token: the only key to a school's public views,
-- public APIs, .ics export and `?school=` sign-up links (slugs are guessable).
-- Volatile default → each existing school gets its own token on ADD COLUMN.
-- 2 × v4 UUID ≈ 244 random bits, 64 lowercase hex chars.
ALTER TABLE schools ADD COLUMN IF NOT EXISTS access_token text NOT NULL
  DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
CREATE UNIQUE INDEX IF NOT EXISTS schools_access_token_key ON schools (access_token);
