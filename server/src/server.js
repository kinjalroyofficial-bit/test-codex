require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('./db');

const app = express();
const PORT = process.env.API_PORT || 4000;
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '128837075351-jaq0sp1rflhpl7ncemtk3m50tb0leee1.apps.googleusercontent.com';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.set('trust proxy', 1);
app.use(express.json());

app.use(
  session({
    store: new pgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: false,
    }),
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function authRequired(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

async function ensureUserByEmail(email, fullName = null) {
  const loweredEmail = email.toLowerCase();
  let existing;
  try {
    existing = await pool.query('SELECT id, email, full_name FROM users WHERE email = $1', [
      loweredEmail,
    ]);
  } catch (error) {
    if (error.code !== '42703') throw error;
    existing = await pool.query('SELECT id, email, NULL::text AS full_name FROM users WHERE email = $1', [
      loweredEmail,
    ]);
  }
  if (existing.rows[0]) {
    if (fullName && !existing.rows[0].full_name) {
      try {
        const updated = await pool.query(
          `UPDATE users
           SET full_name = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING id, email, full_name`,
          [fullName.trim(), existing.rows[0].id]
        );
        return updated.rows[0];
      } catch (error) {
        if (error.code !== '42703') throw error;
      }
    }

    return existing.rows[0];
  }

  let inserted;
  try {
    inserted = await pool.query(
      `INSERT INTO users (email, email_verified, full_name)
       VALUES ($1, true, $2)
       RETURNING id, email, full_name`,
      [loweredEmail, fullName ? fullName.trim() : null]
    );
  } catch (error) {
    if (error.code !== '42703') throw error;
    inserted = await pool.query(
      `INSERT INTO users (email, email_verified)
       VALUES ($1, true)
       RETURNING id, email, NULL::text AS full_name`,
      [loweredEmail]
    );
  }

  return inserted.rows[0];
}

async function getCategoriesByTaskIds(taskIds, userId) {
  if (!taskIds.length) return {};

  const result = await pool.query(
    `SELECT tc.task_id, c.id, c.name, c.user_id
     FROM task_categories tc
     JOIN categories c ON c.id = tc.category_id
     WHERE tc.task_id = ANY($1::uuid[])
       AND (c.user_id IS NULL OR c.user_id = $2)
     ORDER BY tc.task_id ASC, LOWER(c.name) ASC,
       CASE WHEN c.user_id = $2 THEN 0 ELSE 1 END ASC,
       c.name ASC`,
    [taskIds, userId]
  );

  return result.rows.reduce((acc, row) => {
    if (!acc[row.task_id]) acc[row.task_id] = [];
    const normalizedName = `${row.name || ''}`.trim().toLowerCase();
    if (
      normalizedName &&
      acc[row.task_id].some((category) => `${category.name || ''}`.trim().toLowerCase() === normalizedName)
    ) {
      return acc;
    }
    acc[row.task_id].push({ id: row.id, name: row.name });
    return acc;
  }, {});
}

async function syncTaskCategories(taskId, categoryIds, userId) {
  await pool.query('DELETE FROM task_categories WHERE task_id = $1', [taskId]);

  if (!categoryIds?.length) return;

  const validCategories = await pool.query(
    `SELECT DISTINCT ON (LOWER(name)) id
     FROM categories
     WHERE id = ANY($1::uuid[])
       AND (user_id IS NULL OR user_id = $2)
     ORDER BY LOWER(name) ASC,
       CASE WHEN user_id = $2 THEN 0 ELSE 1 END ASC,
       id ASC`,
    [categoryIds, userId]
  );

  for (const row of validCategories.rows) {
    await pool.query(
      `INSERT INTO task_categories (task_id, category_id)
       VALUES ($1, $2)
       ON CONFLICT (task_id, category_id) DO NOTHING`,
      [taskId, row.id]
    );
  }
}

async function ensureCustomCategoryIds(userId, customCategories) {
  const ids = [];
  const cleanedNames = [...new Set((customCategories || []).map((name) => `${name}`.trim()))]
    .filter(Boolean);

  for (const name of cleanedNames) {
    const existing = await pool.query(
      `SELECT id FROM categories
       WHERE (user_id = $1 OR user_id IS NULL)
         AND LOWER(name) = LOWER($2)
       ORDER BY CASE WHEN user_id = $1 THEN 0 ELSE 1 END ASC
       LIMIT 1`,
      [userId, name]
    );

    if (existing.rows[0]) {
      ids.push(existing.rows[0].id);
      continue;
    }

    const inserted = await pool.query(
      `INSERT INTO categories (user_id, name)
       VALUES ($1, $2)
       RETURNING id`,
      [userId, name]
    );
    ids.push(inserted.rows[0].id);
  }

  return ids;
}

function buildAnalyticsRangeClause(range, column = 'created_at') {
  if (range === 'today') return ` AND DATE(${column}) = DATE(NOW())`;
  if (range === '7d') return ` AND ${column} >= NOW() - INTERVAL '7 days'`;
  if (range === '30d') return ` AND ${column} >= NOW() - INTERVAL '30 days'`;
  return '';
}

function roundNumber(value, precision = 4) {
  if (!Number.isFinite(Number(value))) return 0;
  return Number(Number(value).toFixed(precision));
}

function computeStreakDays(dayRows) {
  const uniqueDays = [...new Set(dayRows.map((row) => row.day))].sort().reverse();
  if (!uniqueDays.length) return 0;

  const toDate = (dayString) => new Date(`${dayString}T00:00:00.000Z`);
  let streak = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const prev = toDate(uniqueDays[index - 1]);
    const current = toDate(uniqueDays[index]);
    const diffDays = Math.round((prev - current) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function buildInsights(payload) {
  const insights = [];
  const bestMood = [...(payload.mood.completionRateByMood || [])].sort(
    (a, b) => b.completionRate - a.completionRate
  )[0];
  if (bestMood) {
    insights.push(`You are most productive when ${bestMood.mood}.`);
  }

  const stressedMood = (payload.mood.completionRateByMood || []).find(
    (entry) => entry.mood === 'stressed'
  );
  if (stressedMood && stressedMood.completionRate < payload.summary.completionRate) {
    insights.push('Tasks done in stressed mood have lower completion success than your average.');
  }

  if (payload.time.estimationAccuracyRatio > 1.1) {
    const underestimate = Math.round((payload.time.estimationAccuracyRatio - 1) * 100);
    insights.push(`You underestimate time by about ${underestimate}% on average.`);
  } else if (payload.time.estimationAccuracyRatio > 0 && payload.time.estimationAccuracyRatio < 0.9) {
    const overestimate = Math.round((1 - payload.time.estimationAccuracyRatio) * 100);
    insights.push(`You overestimate time by about ${overestimate}% on average.`);
  }

  if (
    payload.intent.highlights.escapism > 0 &&
    payload.outcome.negativeOutcomeRate > 0.2
  ) {
    insights.push('Escapism tasks correlate with negative outcomes in your current trend.');
  }

  if (!insights.length) {
    insights.push('Keep logging tasks consistently to unlock stronger insight patterns.');
  }

  return insights;
}

app.post('/api/auth/register', loginLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    let result;
    try {
      result = await pool.query(
        `INSERT INTO users (full_name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, full_name, email, email_verified, created_at`,
        [name.trim(), email.toLowerCase(), passwordHash]
      );
    } catch (error) {
      if (error.code !== '42703') throw error;
      result = await pool.query(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, NULL::text AS full_name, email, email_verified, created_at`,
        [email.toLowerCase(), passwordHash]
      );
    }

    req.session.userId = result.rows[0].id;

    return res.status(201).json({
      user: result.rows[0],
      message: 'Registered successfully',
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }

    return res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    let result;
    try {
      result = await pool.query(
        'SELECT id, full_name, email, password_hash FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
    } catch (error) {
      if (error.code !== '42703') throw error;
      result = await pool.query(
        'SELECT id, NULL::text AS full_name, email, password_hash FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
    }

    const user = result.rows[0];
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    return res.json({
      user: { id: user.id, full_name: user.full_name, email: user.email },
      message: 'Logged in',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/google', loginLimiter, async (req, res) => {
  const { idToken } = req.body;

  if (!idToken || !GOOGLE_CLIENT_ID) {
    return res.status(400).json({ error: 'idToken and GOOGLE_CLIENT_ID are required' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const providerUserId = payload.sub;
    const email = payload.email;

    if (!providerUserId || !email) {
      return res.status(401).json({ error: 'Invalid Google token payload' });
    }

    const user = await ensureUserByEmail(email, payload.name || null);

    await pool.query(
      `INSERT INTO user_identities (user_id, provider, provider_user_id, email)
       VALUES ($1, 'google', $2, $3)
       ON CONFLICT (provider, provider_user_id)
       DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
      [user.id, providerUserId, email.toLowerCase()]
    );

    await pool.query('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [user.id]);

    req.session.userId = user.id;
    return res.json({ user, message: 'Google login successful' });
  } catch (error) {
    return res.status(401).json({ error: 'Google authentication failed' });
  }
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: 'Logout failed' });
    }

    return res.clearCookie('connect.sid').json({ message: 'Logged out' });
  });
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  let result;
  try {
    result = await pool.query(
      'SELECT id, full_name, email, email_verified FROM users WHERE id = $1',
      [req.session.userId]
    );
  } catch (error) {
    if (error.code !== '42703') throw error;
    result = await pool.query(
      'SELECT id, NULL::text AS full_name, email, email_verified FROM users WHERE id = $1',
      [req.session.userId]
    );
  }

  return res.json({ user: result.rows[0] || null });
});

app.post('/api/auth/email-verification/request', authRequired, async (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await pool.query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + interval '1 day')`,
    [req.session.userId, tokenHash]
  );

  return res.json({ message: 'Verification token generated', token });
});

app.post('/api/auth/email-verification/confirm', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'token is required' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await pool.query(
    `UPDATE email_verification_tokens
     SET used_at = NOW()
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );

  const row = result.rows[0];
  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  await pool.query('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [row.user_id]);
  return res.json({ message: 'Email verified' });
});

app.post('/api/auth/password-reset/request', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (!userResult.rows[0]) {
    return res.json({ message: 'If the account exists, a reset token was generated.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + interval '30 minutes')`,
    [userResult.rows[0].id, tokenHash]
  );

  return res.json({ message: 'Password reset token generated', token });
});

app.post('/api/auth/password-reset/confirm', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenResult = await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );

  const row = tokenResult.rows[0];
  if (!row) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
    passwordHash,
    row.user_id,
  ]);

  return res.json({ message: 'Password updated' });
});

app.get('/api/categories', authRequired, async (req, res) => {
  const result = await pool.query(
    `SELECT id, name
     FROM (
       SELECT DISTINCT ON (LOWER(name)) id, name
       FROM categories
       WHERE user_id IS NULL OR user_id = $1
       ORDER BY LOWER(name) ASC,
         CASE WHEN user_id = $1 THEN 0 ELSE 1 END ASC,
         name ASC
     ) deduped_categories
     ORDER BY name ASC`,
    [req.session.userId]
  );

  return res.json({ categories: result.rows });
});

app.post('/api/categories', authRequired, async (req, res) => {
  const rawName = req.body?.name || '';
  const name = rawName.trim();
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const existing = await pool.query(
    `SELECT id, name
     FROM categories
     WHERE (user_id = $1 OR user_id IS NULL)
       AND LOWER(name) = LOWER($2)
     ORDER BY CASE WHEN user_id = $1 THEN 0 ELSE 1 END ASC
     LIMIT 1`,
    [req.session.userId, name]
  );

  if (existing.rows[0]) {
    return res.status(200).json({ category: existing.rows[0] });
  }

  const result = await pool.query(
    `INSERT INTO categories (user_id, name)
     VALUES ($1, $2)
     RETURNING id, name`,
    [req.session.userId, name]
  );

  return res.status(201).json({ category: result.rows[0] });
});

app.get('/api/analytics', authRequired, async (req, res) => {
  try {
    const range = ['today', '7d', '30d', 'all'].includes(req.query.range) ? req.query.range : '30d';
    const userId = req.session.userId;
    const rawTimezoneOffsetMinutes = Number.parseInt(`${req.query?.tzOffsetMinutes ?? 0}`, 10);
    const timezoneOffsetMinutes = Number.isFinite(rawTimezoneOffsetMinutes)
      ? rawTimezoneOffsetMinutes
      : 0;
    const rangeClause = buildAnalyticsRangeClause(range);
    const completionDateExpression =
      "((COALESCE(scheduled_for, updated_at) AT TIME ZONE 'UTC') - ($2::int * INTERVAL '1 minute'))";
    const completionRangeClause =
      range === 'today'
        ? ` AND DATE(${completionDateExpression}) = DATE((NOW() AT TIME ZONE 'UTC') - ($2::int * INTERVAL '1 minute'))`
        : buildAnalyticsRangeClause(range, completionDateExpression);
    const registeredDateExpression =
      "((COALESCE(scheduled_for, created_at) AT TIME ZONE 'UTC') - ($2::int * INTERVAL '1 minute'))";
    const registeredTimelineRangeClause =
      range === 'today'
        ? ` AND DATE(${registeredDateExpression}) = DATE((NOW() AT TIME ZONE 'UTC') - ($2::int * INTERVAL '1 minute'))`
        : buildAnalyticsRangeClause(range, registeredDateExpression);

    const summaryQuery = await pool.query(
      `WITH filtered_tasks AS (
         SELECT *
         FROM tasks
         WHERE user_id = $1
           AND deleted_at IS NULL
           ${rangeClause}
       ),
       daily_done AS (
         SELECT DATE(${completionDateExpression}) AS day, COUNT(*)::int AS completed
         FROM tasks
         WHERE user_id = $1
           AND deleted_at IS NULL
           AND status = 'done'
           ${completionRangeClause}
         GROUP BY DATE(${completionDateExpression})
       )
       SELECT
         (SELECT COUNT(*)::int FROM filtered_tasks) AS total_tasks,
         (SELECT COUNT(*)::int FROM filtered_tasks WHERE status = 'done') AS completed_tasks,
         (
           SELECT COUNT(*)::int
           FROM filtered_tasks
           WHERE status = 'done'
             AND due_date IS NOT NULL
             AND DATE(updated_at) <= due_date
         ) AS on_time_completed,
         (SELECT COUNT(*)::int FROM filtered_tasks WHERE status <> 'done') AS backlog,
         (
           SELECT COALESCE(
             AVG(time_taken_minutes::numeric / NULLIF(estimated_duration_minutes, 0)),
             0
           )
           FROM filtered_tasks
         ) AS time_efficiency,
         (SELECT COALESCE(AVG(completed), 0) FROM daily_done) AS daily_task_velocity,
         (
           SELECT COALESCE(SUM(time_taken_minutes), 0)::int
           FROM filtered_tasks
           WHERE time_taken_minutes IS NOT NULL
         ) AS total_time_spent_minutes,
         (
           SELECT COALESCE(SUM(time_taken_minutes), 0)::int
           FROM filtered_tasks
           WHERE intent = 'productive' AND time_taken_minutes IS NOT NULL
         ) AS productive_time_spent_minutes`,
      [userId, timezoneOffsetMinutes]
    );

    const summary = summaryQuery.rows[0] || {};
    const totalTasks = Number(summary.total_tasks || 0);
    const completedTasks = Number(summary.completed_tasks || 0);
    const completionRate = totalTasks ? completedTasks / totalTasks : 0;
    const onTimeCompletionRate = completedTasks
      ? Number(summary.on_time_completed || 0) / completedTasks
      : 0;

    const positiveOutcomeQuery = await pool.query(
      `SELECT
         COALESCE(
           COUNT(*) FILTER (WHERE outcome = 'positive')::numeric / NULLIF(COUNT(*), 0),
           0
         ) AS positive_rate
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}`,
      [userId]
    );
    const productiveIntentQuery = await pool.query(
      `SELECT
         COALESCE(
           COUNT(*) FILTER (WHERE intent = 'productive')::numeric / NULLIF(COUNT(*), 0),
           0
         ) AS productive_ratio
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}`,
      [userId]
    );

    const productivityScore =
      ((completionRate +
        Number(positiveOutcomeQuery.rows[0]?.positive_rate || 0) +
        Number(productiveIntentQuery.rows[0]?.productive_ratio || 0)) /
        3) *
      100;

    const completedOverTimeQuery = await pool.query(
      `SELECT DATE(${completionDateExpression})::text AS day, COUNT(*)::int AS completed
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND status = 'done'
         ${completionRangeClause}
       GROUP BY DATE(${completionDateExpression})
       ORDER BY DATE(${completionDateExpression}) ASC`,
      [userId, timezoneOffsetMinutes]
    );

    const registeredOverTimeQuery = await pool.query(
      `SELECT DATE(${registeredDateExpression})::text AS day, COUNT(*)::int AS registered
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${registeredTimelineRangeClause}
       GROUP BY DATE(${registeredDateExpression})
       ORDER BY DATE(${registeredDateExpression}) ASC`,
      [userId, timezoneOffsetMinutes]
    );

    const estimatedVsActualQuery = await pool.query(
      `SELECT
         DATE(created_at)::text AS day,
         COALESCE(AVG(estimated_duration_minutes), 0)::float AS estimated,
         COALESCE(AVG(time_taken_minutes), 0)::float AS actual
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`,
      [userId]
    );

    const estimationAccuracyQuery = await pool.query(
      `SELECT
         COALESCE(AVG(time_taken_minutes::numeric / NULLIF(estimated_duration_minutes, 0)), 0) AS ratio
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND estimated_duration_minutes IS NOT NULL
         AND time_taken_minutes IS NOT NULL
         ${rangeClause}`,
      [userId]
    );

    const intentDistributionQuery = await pool.query(
      `SELECT COALESCE(intent, 'unknown') AS intent, COUNT(*)::int AS count
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}
       GROUP BY COALESCE(intent, 'unknown')
       ORDER BY count DESC`,
      [userId]
    );

    const moodDistributionQuery = await pool.query(
      `SELECT COALESCE(mood, 'unknown') AS mood, COUNT(*)::int AS count
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}
       GROUP BY COALESCE(mood, 'unknown')
       ORDER BY count DESC`,
      [userId]
    );

    const moodCompletionQuery = await pool.query(
      `SELECT
         COALESCE(mood, 'unknown') AS mood,
         COALESCE(
           COUNT(*) FILTER (WHERE status = 'done')::numeric / NULLIF(COUNT(*), 0),
           0
         ) AS completion_rate
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}
       GROUP BY COALESCE(mood, 'unknown')
       ORDER BY mood ASC`,
      [userId]
    );

    const moodOutcomeHeatmapQuery = await pool.query(
      `SELECT
         COALESCE(mood, 'unknown') AS mood,
         COALESCE(outcome, 'unknown') AS outcome,
         COUNT(*)::int AS count
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}
       GROUP BY COALESCE(mood, 'unknown'), COALESCE(outcome, 'unknown')
       ORDER BY mood, outcome`,
      [userId]
    );

    const outcomeDistributionQuery = await pool.query(
      `SELECT COALESCE(outcome, 'unknown') AS outcome, COUNT(*)::int AS count
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}
       GROUP BY COALESCE(outcome, 'unknown')
       ORDER BY count DESC`,
      [userId]
    );

    const taskTypeDistributionQuery = await pool.query(
      `SELECT COALESCE(task_type, 'normal') AS task_type, COUNT(*)::int AS count
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}
       GROUP BY COALESCE(task_type, 'normal')
       ORDER BY task_type ASC`,
      [userId]
    );

    const outcomeRatesQuery = await pool.query(
      `SELECT
         COALESCE(
           COUNT(*) FILTER (WHERE outcome = 'positive')::numeric / NULLIF(COUNT(*), 0),
           0
         ) AS positive_rate,
         COALESCE(
           COUNT(*) FILTER (WHERE outcome = 'negative')::numeric / NULLIF(COUNT(*), 0),
           0
         ) AS negative_rate,
         COALESCE(
           COUNT(*) FILTER (WHERE intent = 'productive' AND outcome = 'positive')::numeric
           / NULLIF(COUNT(*) FILTER (WHERE intent = 'productive'), 0),
           0
         ) AS productive_positive_rate
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}`,
      [userId]
    );

    const categoryTimeQuery = await pool.query(
      `SELECT
         c.name AS category,
         COALESCE(SUM(t.time_taken_minutes), 0)::int AS minutes
       FROM tasks t
       JOIN task_categories tc ON tc.task_id = t.id
       JOIN categories c ON c.id = tc.category_id
       WHERE t.user_id = $1
         AND t.deleted_at IS NULL
         ${rangeClause.replaceAll('created_at', 't.created_at')}
       GROUP BY c.name
       ORDER BY minutes DESC`,
      [userId]
    );

    const categoryDistributionQuery = await pool.query(
      `SELECT
         c.name AS category,
         COUNT(DISTINCT t.id)::int AS count
       FROM tasks t
       JOIN task_categories tc ON tc.task_id = t.id
       JOIN categories c ON c.id = tc.category_id
       WHERE t.user_id = $1
         AND t.deleted_at IS NULL
         ${rangeClause.replaceAll('created_at', 't.created_at')}
       GROUP BY c.name
       ORDER BY count DESC`,
      [userId]
    );

    const productivityByTimeQuery = await pool.query(
      `SELECT
         CASE
           WHEN EXTRACT(HOUR FROM scheduled_for) BETWEEN 5 AND 11 THEN 'morning'
           WHEN EXTRACT(HOUR FROM scheduled_for) BETWEEN 12 AND 16 THEN 'afternoon'
           WHEN EXTRACT(HOUR FROM scheduled_for) BETWEEN 17 AND 21 THEN 'evening'
           ELSE 'night'
         END AS time_of_day,
         COUNT(*) FILTER (WHERE status = 'done')::int AS completed
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND scheduled_for IS NOT NULL
         ${rangeClause}
       GROUP BY time_of_day
       ORDER BY time_of_day`,
      [userId]
    );

    const procrastinationQuery = await pool.query(
      `SELECT
         COALESCE(
           COUNT(*) FILTER (
             WHERE status = 'done'
               AND scheduled_for IS NOT NULL
               AND updated_at > scheduled_for
           )::numeric
           / NULLIF(COUNT(*) FILTER (WHERE status = 'done' AND scheduled_for IS NOT NULL), 0),
           0
         ) AS procrastination_score
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}`,
      [userId]
    );

    const streakSourceQuery = await pool.query(
      `SELECT DATE(created_at)::text AS day
       FROM tasks
       WHERE user_id = $1
         AND deleted_at IS NULL
         ${rangeClause}
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) DESC`,
      [userId]
    );

    const intentMap = intentDistributionQuery.rows.reduce((acc, row) => {
      acc[row.intent] = Number(row.count || 0);
      return acc;
    }, {});

    const completedByDay = completedOverTimeQuery.rows.reduce((acc, row) => {
      acc[row.day] = Number(row.completed || 0);
      return acc;
    }, {});
    const registeredByDay = registeredOverTimeQuery.rows.reduce((acc, row) => {
      acc[row.day] = Number(row.registered || 0);
      return acc;
    }, {});
    const allTimelineDays = [...new Set([
      ...Object.keys(completedByDay),
      ...Object.keys(registeredByDay),
    ])].sort();

    const payload = {
      summary: {
        completionRate: roundNumber(completionRate),
        onTimeCompletionRate: roundNumber(onTimeCompletionRate),
        productivityScore: roundNumber(productivityScore, 2),
        timeEfficiency: roundNumber(Number(summary.time_efficiency || 0)),
        dailyTaskVelocity: roundNumber(Number(summary.daily_task_velocity || 0)),
        backlog: Number(summary.backlog || 0),
        completedTasks,
        totalTasks,
      },
      time: {
        completedOverTime: allTimelineDays.map((day) => ({
          day,
          completed: completedByDay[day] || 0,
          registered: registeredByDay[day] || 0,
        })),
        estimatedVsActualPerDay: estimatedVsActualQuery.rows.map((row) => ({
          day: row.day,
          estimated: roundNumber(Number(row.estimated || 0), 2),
          actual: roundNumber(Number(row.actual || 0), 2),
        })),
        estimationAccuracyRatio: roundNumber(
          Number(estimationAccuracyQuery.rows[0]?.ratio || 0)
        ),
        totalTimeSpentMinutes: Number(summary.total_time_spent_minutes || 0),
        productiveTimeSpentMinutes: Number(summary.productive_time_spent_minutes || 0),
      },
      intent: {
        distribution: intentDistributionQuery.rows.map((row) => ({
          intent: row.intent,
          count: Number(row.count || 0),
        })),
        highlights: {
          productive: totalTasks ? (intentMap.productive || 0) / totalTasks : 0,
          leisure: totalTasks ? (intentMap.leisure || 0) / totalTasks : 0,
          escapism: totalTasks ? (intentMap.escapism || 0) / totalTasks : 0,
          harmful: totalTasks ? (intentMap.harmful || 0) / totalTasks : 0,
        },
      },
      mood: {
        distribution: moodDistributionQuery.rows.map((row) => ({
          mood: row.mood,
          count: Number(row.count || 0),
        })),
        completionRateByMood: moodCompletionQuery.rows.map((row) => ({
          mood: row.mood,
          completionRate: roundNumber(Number(row.completion_rate || 0)),
        })),
        heatmap: moodOutcomeHeatmapQuery.rows.map((row) => ({
          mood: row.mood,
          outcome: row.outcome,
          count: Number(row.count || 0),
        })),
      },
      outcome: {
        distribution: outcomeDistributionQuery.rows.map((row) => ({
          outcome: row.outcome,
          count: Number(row.count || 0),
        })),
        positiveOutcomeRate: roundNumber(Number(outcomeRatesQuery.rows[0]?.positive_rate || 0)),
        negativeOutcomeRate: roundNumber(Number(outcomeRatesQuery.rows[0]?.negative_rate || 0)),
        productivePositiveRate: roundNumber(
          Number(outcomeRatesQuery.rows[0]?.productive_positive_rate || 0)
        ),
      },
      taskType: {
        distribution: taskTypeDistributionQuery.rows.map((row) => ({
          taskType: row.task_type,
          count: Number(row.count || 0),
        })),
        counts: {
          normal: Number(
            taskTypeDistributionQuery.rows.find((row) => row.task_type === 'normal')?.count || 0
          ),
          continuous: Number(
            taskTypeDistributionQuery.rows.find((row) => row.task_type === 'continuous')?.count || 0
          ),
          eventful: Number(
            taskTypeDistributionQuery.rows.find((row) => row.task_type === 'eventful')?.count || 0
          ),
        },
      },
      category: {
        timeSpentPerCategory: categoryTimeQuery.rows.map((row) => ({
          category: row.category,
          minutes: Number(row.minutes || 0),
        })),
        taskDistribution: categoryDistributionQuery.rows.map((row) => ({
          category: row.category,
          count: Number(row.count || 0),
        })),
      },
      scheduling: {
        productivityByTimeOfDay: productivityByTimeQuery.rows.map((row) => ({
          timeOfDay: row.time_of_day,
          completed: Number(row.completed || 0),
        })),
        procrastinationScore: roundNumber(
          Number(procrastinationQuery.rows[0]?.procrastination_score || 0)
        ),
        streakDays: computeStreakDays(streakSourceQuery.rows),
      },
    };

    payload.insights = buildInsights(payload);

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load analytics' });
  }
});

app.get('/api/tasks', authRequired, async (req, res) => {
  const selectedDate = req.query?.date ? `${req.query.date}` : null;
  const rawTimezoneOffsetMinutes = Number.parseInt(`${req.query?.tzOffsetMinutes ?? 0}`, 10);
  const timezoneOffsetMinutes = Number.isFinite(rawTimezoneOffsetMinutes)
    ? rawTimezoneOffsetMinutes
    : 0;
  const isValidDate =
    !selectedDate || /^\d{4}-\d{2}-\d{2}$/.test(selectedDate);

  if (!isValidDate) {
    return res.status(400).json({ error: 'Invalid date query. Expected YYYY-MM-DD' });
  }

  const result = await pool.query(
    `SELECT id, title, description, status, task_type, mood, intent, outcome, due_date, scheduled_for,
            estimated_duration_minutes, time_taken_minutes, created_at, updated_at
     FROM tasks
     WHERE user_id = $1 AND deleted_at IS NULL
       AND (
         $2::date IS NULL
         OR DATE(
           (COALESCE(scheduled_for, created_at) AT TIME ZONE 'UTC')
           - ($3::int * INTERVAL '1 minute')
         ) = $2::date
       )
     ORDER BY created_at DESC`,
    [req.session.userId, selectedDate, timezoneOffsetMinutes]
  );
  const taskIds = result.rows.map((row) => row.id);
  const categoriesByTaskId = await getCategoriesByTaskIds(taskIds, req.session.userId);
  const tasks = result.rows.map((task) => ({
    ...task,
    categories: categoriesByTaskId[task.id] || [],
  }));

  return res.json({ tasks });
});

app.post('/api/tasks', authRequired, async (req, res) => {
  const {
    title,
    description = null,
    status = 'todo',
    taskType = 'normal',
    task_type: taskTypeSnake = 'normal',
    mood = null,
    intent = null,
    outcome = null,
    dueDate = null,
    scheduledFor = null,
    scheduled_for: scheduledForSnake = null,
    estimatedDurationMinutes = null,
    estimated_duration_minutes: estimatedDurationMinutesSnake = null,
    timeTakenMinutes = null,
    time_taken_minutes: timeTakenMinutesSnake = null,
    categoryIds = [],
    customCategories = [],
  } = req.body;
  const normalizedScheduledFor = scheduledFor || scheduledForSnake || null;
  const normalizedTaskType = taskType || taskTypeSnake || 'normal';
  const normalizedEstimatedDuration =
    estimatedDurationMinutes ?? estimatedDurationMinutesSnake ?? null;
  const normalizedTimeTaken = timeTakenMinutes ?? timeTakenMinutesSnake ?? null;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const result = await pool.query(
    `INSERT INTO tasks (user_id, title, description, status, task_type, mood, intent, outcome, due_date, scheduled_for,
                        estimated_duration_minutes, time_taken_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, title, description, status, task_type, mood, intent, outcome, due_date, scheduled_for,
               estimated_duration_minutes, time_taken_minutes, created_at, updated_at`,
    [
      req.session.userId,
      title,
      description,
      status,
      normalizedTaskType,
      mood,
      intent,
      outcome,
      dueDate,
      normalizedScheduledFor,
      normalizedEstimatedDuration,
      normalizedTimeTaken,
    ]
  );
  const createdTask = result.rows[0];
  const customCategoryIds = await ensureCustomCategoryIds(
    req.session.userId,
    customCategories
  );
  const mergedCategoryIds = [...new Set([...(categoryIds || []), ...customCategoryIds])];
  await syncTaskCategories(createdTask.id, mergedCategoryIds, req.session.userId);
  const categoriesByTaskId = await getCategoriesByTaskIds([createdTask.id], req.session.userId);

  return res.status(201).json({
    task: { ...createdTask, categories: categoriesByTaskId[createdTask.id] || [] },
  });
});

app.patch('/api/tasks/:taskId', authRequired, async (req, res) => {
  const { taskId } = req.params;
  const {
    title,
    description,
    status,
    taskType,
    task_type: taskTypeSnake,
    mood,
    intent,
    outcome,
    dueDate,
    scheduledFor,
    scheduled_for: scheduledForSnake,
    estimatedDurationMinutes,
    estimated_duration_minutes: estimatedDurationMinutesSnake,
    timeTakenMinutes,
    time_taken_minutes: timeTakenMinutesSnake,
    categoryIds,
    customCategories = [],
  } = req.body;
  const normalizedScheduledFor = scheduledFor || scheduledForSnake || null;
  const normalizedTaskType = taskType ?? taskTypeSnake ?? null;
  const normalizedEstimatedDuration =
    estimatedDurationMinutes ?? estimatedDurationMinutesSnake ?? null;
  const normalizedTimeTaken = timeTakenMinutes ?? timeTakenMinutesSnake ?? null;
  const hasMood = Object.prototype.hasOwnProperty.call(req.body, 'mood');
  const hasOutcome = Object.prototype.hasOwnProperty.call(req.body, 'outcome');
  const hasTimeTaken =
    Object.prototype.hasOwnProperty.call(req.body, 'timeTakenMinutes') ||
    Object.prototype.hasOwnProperty.call(req.body, 'time_taken_minutes');
  const hasEstimatedDuration =
    Object.prototype.hasOwnProperty.call(req.body, 'estimatedDurationMinutes') ||
    Object.prototype.hasOwnProperty.call(req.body, 'estimated_duration_minutes');

  const result = await pool.query(
    `UPDATE tasks
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         mood = CASE WHEN $14 THEN $4 ELSE mood END,
         intent = COALESCE($5, intent),
         outcome = CASE WHEN $15 THEN $6 ELSE outcome END,
         due_date = COALESCE($7, due_date),
         scheduled_for = COALESCE($8, scheduled_for),
         estimated_duration_minutes = CASE WHEN $17 THEN $9 ELSE estimated_duration_minutes END,
         time_taken_minutes = CASE WHEN $16 THEN $10 ELSE time_taken_minutes END,
         task_type = COALESCE($11, task_type),
         updated_at = NOW()
     WHERE id = $12 AND user_id = $13 AND deleted_at IS NULL
     RETURNING id, title, description, status, task_type, mood, intent, outcome, due_date, scheduled_for,
               estimated_duration_minutes, time_taken_minutes, created_at, updated_at`,
    [
      title,
      description,
      status,
      mood,
      intent,
      outcome,
      dueDate,
      normalizedScheduledFor,
      normalizedEstimatedDuration,
      normalizedTimeTaken,
      normalizedTaskType,
      taskId,
      req.session.userId,
      hasMood,
      hasOutcome,
      hasTimeTaken,
      hasEstimatedDuration,
    ]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (Array.isArray(categoryIds)) {
    const customCategoryIds = await ensureCustomCategoryIds(
      req.session.userId,
      customCategories
    );
    const mergedCategoryIds = [...new Set([...(categoryIds || []), ...customCategoryIds])];
    await syncTaskCategories(taskId, mergedCategoryIds, req.session.userId);
  }

  const categoriesByTaskId = await getCategoriesByTaskIds([taskId], req.session.userId);
  return res.json({
    task: {
      ...result.rows[0],
      categories: categoriesByTaskId[taskId] || [],
    },
  });
});

app.delete('/api/tasks/:taskId', authRequired, async (req, res) => {
  const { taskId } = req.params;

  const result = await pool.query(
    `UPDATE tasks
     SET deleted_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [taskId, req.session.userId]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ error: 'Task not found' });
  }

  return res.json({ message: 'Task deleted' });
});

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
