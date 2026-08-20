const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// ----------------------------------------------------
// AUTH ROUTES
// ----------------------------------------------------

// Register Endpoint
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );

    res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login Endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ----------------------------------------------------
// DATA ISOLATION ROUTES (Multi-Tenancy)
// ----------------------------------------------------

// Courses
app.get('/api/courses', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/courses', authenticateToken, async (req, res) => {
  try {
    const rows = req.body;
    for (const row of rows) {
      await pool.query(
        `INSERT INTO courses (id, name, code, professor, start_date, end_date, color, schedules, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, code = EXCLUDED.code, professor = EXCLUDED.professor, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, color = EXCLUDED.color, schedules = EXCLUDED.schedules`,
        [row.id, row.name, row.code, row.professor, row.start_date, row.end_date, row.color, JSON.stringify(row.schedules), req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tasks
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY due_date ASC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const rows = req.body;
    for (const row of rows) {
      await pool.query(
        `INSERT INTO tasks (id, category, title, "courseName", "taskType", "taskCode", status, priority, due_date, due_time, description, location, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
         category = EXCLUDED.category, title = EXCLUDED.title, "courseName" = EXCLUDED."courseName", "taskType" = EXCLUDED."taskType", "taskCode" = EXCLUDED."taskCode", status = EXCLUDED.status, priority = EXCLUDED.priority, due_date = EXCLUDED.due_date, due_time = EXCLUDED.due_time, description = EXCLUDED.description, location = EXCLUDED.location`,
        [row.id, row.category, row.title, row.courseName, row.taskType, row.taskCode, row.status, row.priority, row.due_date, row.due_time, row.description, row.location, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && ids.length) {
      await pool.query('DELETE FROM tasks WHERE id = ANY($1) AND user_id = $2', [ids, req.user.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date ASC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const rows = req.body;
    for (const row of rows) {
      await pool.query(
        `INSERT INTO transactions (id, date, category, item, type, amount, method, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date, category = EXCLUDED.category, item = EXCLUDED.item, type = EXCLUDED.type, amount = EXCLUDED.amount, method = EXCLUDED.method`,
        [row.id, row.date, row.category, row.item, row.type, row.amount, row.method, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && ids.length) {
      await pool.query('DELETE FROM transactions WHERE id = ANY($1) AND user_id = $2', [ids, req.user.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Board Settings
app.get('/api/board_settings', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM board_settings WHERE user_id = $1 LIMIT 1', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/board_settings', authenticateToken, async (req, res) => {
  try {
    const row = req.body[0] || req.body;
    await pool.query(
      `INSERT INTO board_settings (id, theme, "appName", "budgetCategories", "paymentMethods", "taskCategories", "taskPriorities", "taskTypes", "showDashboardMoneyMonitor", "showDashboardExpenseBreakdown", "showDashboardMiniCalendar", "showScheduleTimeline", "showSidebar", accent_color, layout_density, sidebar_expand_on_hover, "genCalShow", accessibility_mode, default_landing_tab, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (id, user_id) DO UPDATE SET
       theme = EXCLUDED.theme, "appName" = EXCLUDED."appName", "budgetCategories" = EXCLUDED."budgetCategories", "paymentMethods" = EXCLUDED."paymentMethods", "taskCategories" = EXCLUDED."taskCategories", "taskPriorities" = EXCLUDED."taskPriorities", "taskTypes" = EXCLUDED."taskTypes", "showDashboardMoneyMonitor" = EXCLUDED."showDashboardMoneyMonitor", "showDashboardExpenseBreakdown" = EXCLUDED."showDashboardExpenseBreakdown", "showDashboardMiniCalendar" = EXCLUDED."showDashboardMiniCalendar", "showScheduleTimeline" = EXCLUDED."showScheduleTimeline", "showSidebar" = EXCLUDED."showSidebar", accent_color = EXCLUDED.accent_color, layout_density = EXCLUDED.layout_density, sidebar_expand_on_hover = EXCLUDED.sidebar_expand_on_hover, "genCalShow" = EXCLUDED."genCalShow", accessibility_mode = EXCLUDED.accessibility_mode, default_landing_tab = EXCLUDED.default_landing_tab`,
      [row.id || 'board', row.theme, row.appName, JSON.stringify(row.budgetCategories), JSON.stringify(row.paymentMethods), JSON.stringify(row.taskCategories), JSON.stringify(row.taskPriorities), JSON.stringify(row.taskTypes), row.showDashboardMoneyMonitor, row.showDashboardExpenseBreakdown, row.showDashboardMiniCalendar, row.showScheduleTimeline, row.showSidebar, row.accent_color, row.layout_density, row.sidebar_expand_on_hover, JSON.stringify(row.genCalShow), row.accessibility_mode, row.default_landing_tab, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
