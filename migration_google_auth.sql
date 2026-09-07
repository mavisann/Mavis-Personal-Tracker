-- Safe, non-destructive Google authentication migration.
-- This migration does not delete, update, copy, or recreate existing rows.
BEGIN;

-- Allows Google-only users to have no password hash.
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

-- New fields are nullable, so every existing row remains valid and unchanged.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Partial unique indexes enforce uniqueness only for future non-null values.
-- NULL values are not changed and multiple existing NULLs remain allowed.
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique_idx
  ON users (google_id)
  WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (email)
  WHERE email IS NOT NULL;

COMMIT;
