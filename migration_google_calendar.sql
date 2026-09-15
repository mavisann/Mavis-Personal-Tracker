-- Google Calendar integration fields.
-- Non-destructive: existing rows and credentials are preserved.
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id TEXT,
  ADD COLUMN IF NOT EXISTS google_email TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS google_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
  ON users (google_id)
  WHERE google_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_google_event_id
  ON tasks (google_event_id)
  WHERE google_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_courses_user_id
  ON courses (user_id);

COMMIT;
