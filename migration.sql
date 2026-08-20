-- migration.sql
BEGIN;

-- 1. Create the users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add user_id to existing tables
ALTER TABLE courses ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE board_settings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Update board_settings to support multiple users properly
-- If it has a primary key on id='board', we need to change it
ALTER TABLE board_settings DROP CONSTRAINT IF EXISTS board_settings_pkey;

-- 🔴 FIX: A primary key cannot contain NULL values. 
-- Since we just added user_id, existing rows have user_id = NULL.
-- We must delete those old rows before creating the new primary key.
-- (The frontend will automatically recreate the settings row for new users)
DELETE FROM board_settings WHERE user_id IS NULL;

-- Make user_id NOT NULL so it can be safely used in a Primary Key
ALTER TABLE board_settings ALTER COLUMN user_id SET NOT NULL;

-- Recreate the primary key to include user_id.
ALTER TABLE board_settings ADD PRIMARY KEY (id, user_id);

COMMIT;
