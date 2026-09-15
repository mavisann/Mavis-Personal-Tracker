const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
];
const calendarOAuthClient = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'postmessage'
);

if (!process.env.DATABASE_URL || !JWT_SECRET) {
  throw new Error('DATABASE_URL and JWT_SECRET environment variables are required.');
}

// Only the actual frontend origin may call this API. Update this if the
// site's domain ever changes (custom domain, different Netlify site, etc).
// Note: no trailing slash — must match the browser's Origin header exactly.
const ALLOWED_ORIGINS = [
  'https://mavisann.github.io',
  'https://mavis-studyhub.netlify.app',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());
app.use(compression());

// Serve the static frontend when the Node app is deployed directly.
app.use(express.static(__dirname, { index: false }));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Supabase's Postgres requires SSL. rejectUnauthorized: false is needed
  // here because Supabase uses a certificate chain that Node's default
  // trust store doesn't recognize — this still encrypts the connection,
  // it just skips validating the certificate against a known CA.
  ssl: { rejectUnauthorized: false }
});

// Surface pool-level connection errors (auth failures, network issues,
// SSL problems) in the logs with real detail, instead of only ever
// seeing the generic 500 that route handlers fall back to.
pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err);
});

async function verifyGoogleToken(token) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('Google authentication is not configured.');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  return ticket.getPayload();
}

function issueToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || null,
    googleLinked: Boolean(user.google_id)
  };
}

function dateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addHours(dateString, timeString, hours) {
  const parts = String(timeString || '09:00').split(':').map(Number);
  const totalMinutes = (parts[0] || 0) * 60 + (parts[1] || 0) + (hours * 60);
  const dayOffset = Math.floor(totalMinutes / 1440);
  const minutes = totalMinutes % 1440;
  return `${addDays(dateString, dayOffset)}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
}

function taskCalendarEvent(task) {
  const date = dateOnly(task.due_date);
  if (!date) return null;
  const time = task.due_time ? String(task.due_time).slice(0, 5) : null;
  const summary = task.title || 'StudyHub task';
  const description = [task.description, task.courseName || task.category].filter(Boolean).join('\n');
  return {
    event: {
      summary,
      description,
      extendedProperties: { private: { studyhubManaged: 'true', studyhubTaskId: String(task.id) } },
      location: task.location || undefined,
      start: time
        ? { dateTime: `${date}T${time}:00`, timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Asia/Manila' }
        : { date },
      end: time
        ? { dateTime: addHours(date, time, 1), timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Asia/Manila' }
        : { date: addDays(date, 1) }
    }
  };
}

function courseCalendarEvents(course) {
  const startDate = dateOnly(course.start_date);
  const schedules = Array.isArray(course.schedules) ? course.schedules : [];
  if (!startDate) return [];
  return schedules.map((schedule, index) => {
    const days = Array.isArray(schedule.days) ? schedule.days : [];
    const byDay = days.map((day) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][Number(day)]).filter(Boolean);
    if (!byDay.length || !schedule.startTime || !schedule.endTime) return null;
    const endDate = dateOnly(course.end_date);
    const until = endDate ? `;UNTIL=${endDate.replace(/-/g, '')}T235959Z` : '';
    return {
      event: {
        summary: `[Class] ${course.name || 'Course'}${course.code ? ` (${course.code})` : ''}`,
        description: course.professor ? `Professor: ${course.professor}` : '',
        extendedProperties: { private: { studyhubManaged: 'true', studyhubCourseId: String(course.id), studyhubScheduleIndex: String(index) } },
        location: schedule.room || undefined,
        start: {
          dateTime: `${startDate}T${String(schedule.startTime).slice(0, 5)}:00`,
          timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Asia/Manila'
        },
        end: {
          dateTime: `${startDate}T${String(schedule.endTime).slice(0, 5)}:00`,
          timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Asia/Manila'
        },
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byDay.join(',')}${until}`]
      }
    };
  }).filter(Boolean);
}

const studyHubCalendarLocks = new Map();

async function getStudyHubCalendarUncached(calendar, userId) {
  const result = await pool.query('SELECT google_calendar_id FROM users WHERE id = $1', [userId]);
  const savedId = result.rows[0] && result.rows[0].google_calendar_id;
  if (savedId) {
    try {
      await calendar.calendars.get({ calendarId: savedId });
      return savedId;
    } catch (error) {
      if (error.code !== 404) throw error;
    }
  }
  const calendars = await calendar.calendarList.list({ maxResults: 250, showHidden: true });
  const existing = (calendars.data.items || []).find((item) =>
    item.summary === 'StudyHub' && item.description === 'Events managed by StudyHub'
  );
  if (existing) {
    await pool.query('UPDATE users SET google_calendar_id = $1 WHERE id = $2', [existing.id, userId]);
    return existing.id;
  }
  const created = await calendar.calendars.insert({
    requestBody: {
      summary: 'StudyHub',
      description: 'Events managed by StudyHub',
      timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || 'Asia/Manila'
    }
  });
  await pool.query('UPDATE users SET google_calendar_id = $1 WHERE id = $2', [created.data.id, userId]);
  return created.data.id;
}

function getStudyHubCalendar(calendar, userId) {
  if (!studyHubCalendarLocks.has(userId)) {
    const lock = getStudyHubCalendarUncached(calendar, userId).finally(() => studyHubCalendarLocks.delete(userId));
    studyHubCalendarLocks.set(userId, lock);
  }
  return studyHubCalendarLocks.get(userId);
}

async function findManagedEvent(calendar, calendarId, property, value) {
  const response = await calendar.events.list({
    calendarId,
    maxResults: 10,
    showDeleted: false,
    privateExtendedProperty: [`${property}=${value}`]
  });
  return (response.data.items || []).find((event) =>
    event.extendedProperties &&
    event.extendedProperties.private &&
    event.extendedProperties.private.studyhubManaged === 'true'
  ) || null;
}

async function getCalendarClient(userId) {
  const result = await pool.query(
    'SELECT google_refresh_token, google_calendar_sync_enabled FROM users WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user || !user.google_refresh_token || !user.google_calendar_sync_enabled) return null;
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'postmessage'
  );
  client.setCredentials({ refresh_token: user.google_refresh_token });
  return google.calendar({ version: 'v3', auth: client });
}

async function syncTaskToCalendar(userId, task) {
  const calendar = await getCalendarClient(userId);
  if (!calendar || !task.due_date) return;
  const calendarId = await getStudyHubCalendar(calendar, userId);
  const event = taskCalendarEvent(task).event;
  const options = { calendarId, requestBody: event };
  if (task.google_event_id) {
    try {
      await calendar.events.update({ ...options, eventId: task.google_event_id });
      return;
    } catch (error) {
      if (error.code !== 404) throw error;
    }
  }
  const existing = await findManagedEvent(calendar, calendarId, 'studyhubTaskId', String(task.id));
  if (existing) {
    await calendar.events.update({ ...options, eventId: existing.id });
    await pool.query('UPDATE tasks SET google_event_id = $1 WHERE id = $2 AND user_id = $3', [existing.id, task.id, userId]);
    return;
  }
  const inserted = await calendar.events.insert(options);
  await pool.query('UPDATE tasks SET google_event_id = $1 WHERE id = $2 AND user_id = $3', [inserted.data.id, task.id, userId]);
}

async function syncCourseToCalendar(userId, course) {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return;
  const calendarId = await getStudyHubCalendar(calendar, userId);
  const oldIds = Array.isArray(course.google_event_ids) ? course.google_event_ids : [];
  const createdIds = [];
  for (let i = 0; i < courseCalendarEvents(course).length; i += 1) {
    const item = courseCalendarEvents(course)[i];
    const existingId = oldIds[i];
    if (existingId) {
      try {
        await calendar.events.update({ calendarId, eventId: existingId, requestBody: item.event });
        createdIds.push(existingId);
        continue;
      } catch (error) {
        if (error.code !== 404) throw error;
      }
    }
    const existing = await findManagedEvent(calendar, calendarId, 'studyhubCourseId', String(course.id));
    const matching = existing && existing.extendedProperties.private.studyhubScheduleIndex === String(i) ? existing : null;
    if (matching) {
      await calendar.events.update({ calendarId, eventId: matching.id, requestBody: item.event });
      createdIds.push(matching.id);
      continue;
    }
    const inserted = await calendar.events.insert({ calendarId, requestBody: item.event });
    createdIds.push(inserted.data.id);
  }
  for (const eventId of oldIds.slice(createdIds.length)) {
    try { await calendar.events.delete({ calendarId, eventId }); } catch (error) {
      if (error.code !== 404) throw error;
    }
  }
  await pool.query('UPDATE courses SET google_event_ids = $1::jsonb WHERE id = $2 AND user_id = $3', [JSON.stringify(createdIds), course.id, userId]);
}

function runCalendarOperation(operation, label) {
  Promise.resolve().then(operation).catch((error) => console.error(`${label} failed:`, error));
}

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

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ----------------------------------------------------
// AUTH ROUTES
// ----------------------------------------------------

// Register Endpoint
app.post('/api/register', async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const normalizedEmail = email ? email.trim().toLowerCase() : null;
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  try {
    const existingUser = await pool.query(
      'SELECT 1 FROM users WHERE username = $1 OR ($2::text IS NOT NULL AND LOWER(email) = $2) LIMIT 1',
      [username, normalizedEmail]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email is already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email, google_id',
      [username, hashedPassword, normalizedEmail]
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
    const match = Boolean(user.password_hash) && await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = issueToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public browser configuration. Never return database credentials or secrets.
app.get('/api/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null });
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required' });
  }

  try {
    const payload = await verifyGoogleToken(credential);
    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ error: 'Google account could not be verified' });
    }

    const email = payload.email.toLowerCase();
    let result = await pool.query(
      'SELECT id, username, email, google_id FROM users WHERE google_id = $1 OR LOWER(email) = $2 LIMIT 1',
      [payload.sub, email]
    );
    let user = result.rows[0];

    if (!user) {
      const baseUsername = (email.split('@')[0] || 'google-user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 40) || 'google-user';
      let username = baseUsername;
      let suffix = 1;
      while ((await pool.query('SELECT 1 FROM users WHERE username = $1', [username])).rowCount) {
        username = (baseUsername.slice(0, 35) + '-' + suffix).slice(0, 40);
        suffix += 1;
      }

      result = await pool.query(
        'INSERT INTO users (username, password_hash, google_id, email) VALUES ($1, NULL, $2, $3) RETURNING id, username, email, google_id',
        [username, payload.sub, email]
      );
      user = result.rows[0];
    } else {
      if (user.google_id && user.google_id !== payload.sub) {
        return res.status(409).json({ error: 'This email is already linked to another Google account' });
      }
      result = await pool.query(
        'UPDATE users SET google_id = COALESCE(google_id, $1), email = COALESCE(email, $2) WHERE id = $3 RETURNING id, username, email, google_id',
        [payload.sub, email, user.id]
      );
      user = result.rows[0];
    }

    res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Google authentication failed:', error);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, google_id FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    console.error('Profile lookup failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/google/link', authenticateToken, async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Google credential is required' });
  }

  try {
    const payload = await verifyGoogleToken(credential);
    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ error: 'Google account could not be verified' });
    }

    const email = payload.email.toLowerCase();
    const existing = await pool.query(
      'SELECT id FROM users WHERE (google_id = $1 OR LOWER(email) = $2) AND id <> $3 LIMIT 1',
      [payload.sub, email, req.user.id]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'This Google account is already linked to another user' });
    }

    const result = await pool.query(
      'UPDATE users SET google_id = $1, email = $2 WHERE id = $3 RETURNING id, username, email, google_id',
      [payload.sub, email, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });

    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    console.error('Google account linking failed:', error);
    res.status(401).json({ error: 'Google account linking failed' });
  }
});

app.patch('/api/account', authenticateToken, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  if (username !== undefined && !/^[a-zA-Z0-9_]{3,40}$/.test(username.trim())) {
    return res.status(400).json({ error: 'Username must be 3-40 letters, numbers, or underscores' });
  }
  if (newPassword !== undefined && newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const current = await pool.query(
      'SELECT id, username, email, google_id, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!current.rows.length) return res.status(404).json({ error: 'User not found' });
    const user = current.rows[0];

    if (username !== undefined && username.trim().toLowerCase() !== user.username.toLowerCase()) {
      const duplicate = await pool.query(
        'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2',
        [username.trim(), user.id]
      );
      if (duplicate.rows.length) return res.status(409).json({ error: 'Username is already in use' });
    }

    if (user.password_hash && newPassword !== undefined) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    const passwordHash = newPassword === undefined
      ? user.password_hash
      : await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      'UPDATE users SET username = COALESCE($1, username), password_hash = $2 WHERE id = $3 RETURNING id, username, email, google_id',
      [username === undefined ? null : username.trim(), passwordHash, user.id]
    );
    const updatedUser = result.rows[0];
    res.json({ token: issueToken(updatedUser), user: publicUser(updatedUser) });
  } catch (error) {
    console.error('Account update failed:', error);
    res.status(500).json({ error: 'Could not update account' });
  }
});

app.post('/api/auth/google/unlink', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET google_id = NULL, email = NULL WHERE id = $1 AND password_hash IS NOT NULL RETURNING id, username, email, google_id',
      [req.user.id]
    );
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Set a password before unlinking Google from this account' });
    }
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    console.error('Google account unlinking failed:', error);
    res.status(500).json({ error: 'Could not unlink Google account' });
  }
});

// ----------------------------------------------------
// GOOGLE CALENDAR ROUTES
// ----------------------------------------------------

app.get('/api/user/google-status', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT calendar_google_id, google_email, google_refresh_token, google_calendar_sync_enabled, google_calendar_id FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    res.json({
      linked: Boolean(user && user.calendar_google_id && user.google_refresh_token),
      email: user ? user.google_email : null,
      syncEnabled: Boolean(user && user.calendar_google_id && user.google_refresh_token && user.google_calendar_sync_enabled),
      calendarVisible: Boolean(user && user.google_calendar_id)
    });
  } catch (error) {
    console.error('Google status lookup failed:', error);
    res.status(500).json({ error: 'Could not load Google account status.' });
  }
});

app.post('/api/user/google-connect', authenticateToken, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Google authorization code is required.' });
  try {
    const { tokens } = await calendarOAuthClient.getToken(code);
    if (!tokens.refresh_token) return res.status(400).json({ error: 'Google did not return a refresh token. Please try again.' });
    calendarOAuthClient.setCredentials(tokens);
    const userInfo = await calendarOAuthClient.request({ url: 'https://openidconnect.googleapis.com/v1/userinfo' });
    const googleUser = userInfo.data;
    if (!googleUser.sub || !googleUser.email) return res.status(400).json({ error: 'Google account information is incomplete.' });
    const result = await pool.query(
      `UPDATE users
       SET calendar_google_id = $1, google_email = $2, google_refresh_token = $3,
           google_calendar_sync_enabled = TRUE
       WHERE id = $4
       RETURNING google_email, google_calendar_sync_enabled`,
      [googleUser.sub, googleUser.email.toLowerCase(), tokens.refresh_token, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
    runCalendarOperation(() => Promise.all([
      pool.query('SELECT * FROM tasks WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT * FROM courses WHERE user_id = $1', [req.user.id])
    ]).then(([tasks, courses]) => Promise.all([
      ...tasks.rows.map((task) => syncTaskToCalendar(req.user.id, task)),
      ...courses.rows.map((course) => syncCourseToCalendar(req.user.id, course))
    ])), 'Initial Google Calendar sync');
    res.json({ linked: true, email: result.rows[0].google_email, syncEnabled: true, calendarVisible: true });
  } catch (error) {
    console.error('Google Calendar connection failed:', error);
    res.status(500).json({ error: 'Could not connect Google Calendar.' });
  }
});

app.post('/api/user/google-toggle-sync', authenticateToken, async (req, res) => {
  if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean.' });
  try {
    const result = await pool.query(
      `UPDATE users SET google_calendar_sync_enabled = $1
       WHERE id = $2 AND calendar_google_id IS NOT NULL AND google_refresh_token IS NOT NULL
       RETURNING google_calendar_sync_enabled`,
      [req.body.enabled, req.user.id]
    );
    if (!result.rows.length) return res.status(400).json({ error: 'Connect a Google account before changing sync.' });
    res.json({ syncEnabled: result.rows[0].google_calendar_sync_enabled });
  } catch (error) {
    console.error('Google Calendar sync toggle failed:', error);
    res.status(500).json({ error: 'Could not update calendar sync.' });
  }
});

app.post('/api/user/google-toggle-visibility', authenticateToken, async (req, res) => {
  if (typeof req.body.visible !== 'boolean') return res.status(400).json({ error: 'visible must be a boolean.' });
  try {
    const result = await pool.query(
      'SELECT google_refresh_token, google_calendar_id FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length || !result.rows[0].google_refresh_token || !result.rows[0].google_calendar_id) {
      return res.status(400).json({ error: 'Connect a Google account before changing calendar visibility.' });
    }
    const calendar = await getCalendarClient(req.user.id);
    await calendar.calendarList.patch({
      calendarId: result.rows[0].google_calendar_id,
      requestBody: { selected: req.body.visible }
    });
    res.json({ calendarVisible: req.body.visible });
  } catch (error) {
    console.error('Google Calendar visibility update failed:', error);
    res.status(500).json({ error: 'Could not update calendar visibility. Re-authorize Calendar access if needed.' });
  }
});

app.post('/api/user/google-disconnect', authenticateToken, async (req, res) => {
  try {
    const current = await pool.query(
      'SELECT google_refresh_token FROM users WHERE id = $1',
      [req.user.id]
    );
    const refreshToken = current.rows[0] && current.rows[0].google_refresh_token;
    if (refreshToken) {
      const revokeClient = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'postmessage'
      );
      try {
        await revokeClient.revokeToken(refreshToken);
      } catch (error) {
        // Local credentials are still cleared if Google's revocation endpoint
        // is temporarily unavailable.
        console.error('Google Calendar token revocation failed:', error);
      }
    }
    const result = await pool.query(
      `UPDATE users
       SET calendar_google_id = NULL, google_email = NULL, google_refresh_token = NULL,
           google_calendar_sync_enabled = FALSE
       WHERE id = $1
       RETURNING id`,
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json({ linked: false, email: null, syncEnabled: false });
  } catch (error) {
    console.error('Google Calendar disconnect failed:', error);
    res.status(500).json({ error: 'Could not disconnect Google Calendar.' });
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
    await Promise.all(rows.map(async (row) => {
      const result = await pool.query(
        `INSERT INTO courses (id, name, code, professor, start_date, end_date, color, schedules, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, code = EXCLUDED.code, professor = EXCLUDED.professor, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, color = EXCLUDED.color, schedules = EXCLUDED.schedules
         WHERE courses.user_id = EXCLUDED.user_id
         RETURNING *`,
        [row.id, row.name, row.code, row.professor, row.start_date, row.end_date, row.color, JSON.stringify(row.schedules), req.user.id]
      );
      runCalendarOperation(() => syncCourseToCalendar(req.user.id, result.rows[0]), 'Course calendar sync');
    }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/courses', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && ids.length) {
      const existing = await pool.query(
        'SELECT id, google_event_ids FROM courses WHERE id = ANY($1) AND user_id = $2',
        [ids, req.user.id]
      );
      await pool.query('DELETE FROM courses WHERE id = ANY($1) AND user_id = $2', [ids, req.user.id]);
      runCalendarOperation(async () => {
        const calendar = await getCalendarClient(req.user.id);
        if (!calendar) return;
        const calendarId = await getStudyHubCalendar(calendar, req.user.id);
        for (const course of existing.rows) {
          for (const eventId of (Array.isArray(course.google_event_ids) ? course.google_event_ids : [])) {
            try { await calendar.events.delete({ calendarId, eventId }); } catch (error) {
              if (error.code !== 404) throw error;
            }
          }
        }
      }, 'Course calendar deletion');
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
    await Promise.all(rows.map(async (row) => {
      const result = await pool.query(
        `INSERT INTO tasks (id, category, title, "courseName", "taskType", "taskCode", status, priority, due_date, due_time, description, location, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
        category = EXCLUDED.category, title = EXCLUDED.title, "courseName" = EXCLUDED."courseName", "taskType" = EXCLUDED."taskType", "taskCode" = EXCLUDED."taskCode", status = EXCLUDED.status, priority = EXCLUDED.priority, due_date = EXCLUDED.due_date, due_time = EXCLUDED.due_time, description = EXCLUDED.description, location = EXCLUDED.location
        WHERE tasks.user_id = EXCLUDED.user_id
        RETURNING *`,
        [row.id, row.category, row.title, row.courseName, row.taskType, row.taskCode, row.status, row.priority, row.due_date, row.due_time, row.description, row.location, req.user.id]
      );
      runCalendarOperation(() => syncTaskToCalendar(req.user.id, result.rows[0]), 'Task calendar sync');
    }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;
    if (ids && ids.length) {
      const existing = await pool.query(
        'SELECT id, google_event_id FROM tasks WHERE id = ANY($1) AND user_id = $2',
        [ids, req.user.id]
      );
      await pool.query('DELETE FROM tasks WHERE id = ANY($1) AND user_id = $2', [ids, req.user.id]);
      runCalendarOperation(async () => {
        const calendar = await getCalendarClient(req.user.id);
        if (!calendar) return;
        const calendarId = await getStudyHubCalendar(calendar, req.user.id);
        for (const task of existing.rows) {
          if (!task.google_event_id) continue;
          try { await calendar.events.delete({ calendarId, eventId: task.google_event_id }); } catch (error) {
            if (error.code !== 404) throw error;
          }
        }
      }, 'Task calendar deletion');
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
    await Promise.all(rows.map((row) => pool.query(
        `INSERT INTO transactions (id, date, category, item, type, amount, method, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date, category = EXCLUDED.category, item = EXCLUDED.item, type = EXCLUDED.type, amount = EXCLUDED.amount, method = EXCLUDED.method
         WHERE transactions.user_id = EXCLUDED.user_id`,
        [row.id, row.date, row.category, row.item, row.type, row.amount, row.method, req.user.id]
      )));
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

app.get('/api/bootstrap', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [courses, tasks, transactions, boardSettings] = await Promise.all([
      pool.query('SELECT * FROM courses WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY due_date ASC', [userId]),
      pool.query('SELECT * FROM transactions WHERE user_id = $1 ORDER BY date ASC', [userId]),
      pool.query('SELECT * FROM board_settings WHERE user_id = $1 LIMIT 1', [userId])
    ]);
    res.json({
      courses: courses.rows,
      tasks: tasks.rows,
      transactions: transactions.rows,
      boardSettings: boardSettings.rows
    });
  } catch (err) {
    console.error('Bootstrap data load failed:', err);
    res.status(500).json({ error: 'Could not load board data' });
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
