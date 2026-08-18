BEGIN;

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT,
    code TEXT,
    professor TEXT,
    days JSONB,
    start_time TIME,
    end_time TIME,
    start_date DATE,
    end_date DATE,
    modality TEXT,
    room TEXT,
    color TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
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

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date DATE,
    category TEXT,
    item TEXT,
    type TEXT,
    amount NUMERIC(10, 2),
    method TEXT
);

CREATE TABLE IF NOT EXISTS board_settings (
    id TEXT PRIMARY KEY DEFAULT 'board',
    theme TEXT,
    "totalBudget" NUMERIC(10, 2),
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
    default_landing_tab TEXT
);

COMMIT;