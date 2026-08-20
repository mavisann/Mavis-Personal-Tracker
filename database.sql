-- Run this entire script in Supabase SQL Editor (fresh start, no Supabase Auth used)

BEGIN;

-- Drop old tables
DROP TABLE IF EXISTS board_settings CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Custom users table (no Supabase Auth, we manage this ourselves)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses
CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT,
    code TEXT,
    professor TEXT,
    start_date DATE,
    end_date DATE,
    color TEXT,
    schedules JSONB
);

-- 3. Tasks
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT,
    title TEXT,
    "courseName" TEXT,
    "taskType" TEXT,
    "taskCode" TEXT,
    status TEXT,
    priority TEXT,
    due_date DATE,
    due_time TIME,
    description TEXT,
    location TEXT
);

-- 4. Transactions
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE,
    category TEXT,
    item TEXT,
    type TEXT,
    amount NUMERIC(10, 2),
    method TEXT
);

-- 5. Board Settings
CREATE TABLE board_settings (
    id TEXT NOT NULL DEFAULT 'board',
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT,
    "appName" TEXT,
    "budgetCategories" JSONB,
    "paymentMethods" JSONB,
    "taskCategories" JSONB,
    "taskPriorities" JSONB,
    "taskTypes" JSONB,
    "showDashboardMoneyMonitor" BOOLEAN,
    "showDashboardExpenseBreakdown" BOOLEAN,
    "showDashboardMiniCalendar" BOOLEAN,
    "showScheduleTimeline" BOOLEAN,
    "showSidebar" BOOLEAN,
    accent_color TEXT,
    layout_density TEXT,
    sidebar_expand_on_hover BOOLEAN,
    "genCalShow" JSONB,
    accessibility_mode TEXT,
    default_landing_tab TEXT,
    PRIMARY KEY (id, user_id)
);

-- ============================================================
-- RLS: Allow the anon key to read/write all rows.
-- User isolation is enforced at the application level (user_id filtering in JS).
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON courses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON tasks FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON transactions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon full access" ON board_settings FOR ALL TO anon USING (true) WITH CHECK (true);

COMMIT;
