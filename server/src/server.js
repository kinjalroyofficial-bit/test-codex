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
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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
  const existing = await pool.query('SELECT id, email, full_name FROM users WHERE email = $1', [
    loweredEmail,
  ]);
  if (existing.rows[0]) {
    if (fullName && !existing.rows[0].full_name) {
      const updated = await pool.query(
        `UPDATE users
         SET full_name = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, email, full_name`,
        [fullName.trim(), existing.rows[0].id]
      );
      return updated.rows[0];
    }

    return existing.rows[0];
  }

  const inserted = await pool.query(
    `INSERT INTO users (email, email_verified, full_name)
     VALUES ($1, true, $2)
     RETURNING id, email, full_name`,
    [loweredEmail, fullName ? fullName.trim() : null]
  );

  return inserted.rows[0];
}

async function getCategoriesByTaskIds(taskIds, userId) {
  if (!taskIds.length) return {};

  const result = await pool.query(
    `SELECT tc.task_id, c.id, c.name
     FROM task_categories tc
     JOIN categories c ON c.id = tc.category_id
     WHERE tc.task_id = ANY($1::uuid[])
       AND (c.user_id IS NULL OR c.user_id = $2)
     ORDER BY c.name ASC`,
    [taskIds, userId]
  );

  return result.rows.reduce((acc, row) => {
    if (!acc[row.task_id]) acc[row.task_id] = [];
    acc[row.task_id].push({ id: row.id, name: row.name });
    return acc;
  }, {});
}

async function syncTaskCategories(taskId, categoryIds, userId) {
  await pool.query('DELETE FROM task_categories WHERE task_id = $1', [taskId]);

  if (!categoryIds?.length) return;

  const validCategories = await pool.query(
    `SELECT id FROM categories
     WHERE id = ANY($1::uuid[])
       AND (user_id IS NULL OR user_id = $2)`,
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
       WHERE user_id = $1 AND LOWER(name) = LOWER($2)
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

app.post('/api/auth/register', loginLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, email_verified, created_at`,
      [name.trim(), email.toLowerCase(), passwordHash]
    );

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
    const result = await pool.query(
      'SELECT id, full_name, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

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
  const result = await pool.query(
    'SELECT id, full_name, email, email_verified FROM users WHERE id = $1',
    [req.session.userId]
  );

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
     FROM categories
     WHERE user_id IS NULL OR user_id = $1
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
     WHERE user_id = $1 AND LOWER(name) = LOWER($2)
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

app.get('/api/tasks', authRequired, async (req, res) => {
  const result = await pool.query(
    `SELECT id, title, description, status, mood, intent, outcome, due_date, scheduled_for, created_at, updated_at
     FROM tasks
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [req.session.userId]
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
    mood = null,
    intent = null,
    outcome = null,
    dueDate = null,
    scheduledFor = null,
    scheduled_for: scheduledForSnake = null,
    categoryIds = [],
    customCategories = [],
  } = req.body;
  const normalizedScheduledFor = scheduledFor || scheduledForSnake || null;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const result = await pool.query(
    `INSERT INTO tasks (user_id, title, description, status, mood, intent, outcome, due_date, scheduled_for)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, title, description, status, mood, intent, outcome, due_date, scheduled_for, created_at, updated_at`,
    [
      req.session.userId,
      title,
      description,
      status,
      mood,
      intent,
      outcome,
      dueDate,
      normalizedScheduledFor,
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
    mood,
    intent,
    outcome,
    dueDate,
    scheduledFor,
    scheduled_for: scheduledForSnake,
    categoryIds,
    customCategories = [],
  } = req.body;
  const normalizedScheduledFor = scheduledFor || scheduledForSnake || null;

  const result = await pool.query(
    `UPDATE tasks
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3, status),
         mood = COALESCE($4, mood),
         intent = COALESCE($5, intent),
         outcome = COALESCE($6, outcome),
         due_date = COALESCE($7, due_date),
         scheduled_for = COALESCE($8, scheduled_for),
         updated_at = NOW()
     WHERE id = $9 AND user_id = $10 AND deleted_at IS NULL
     RETURNING id, title, description, status, mood, intent, outcome, due_date, scheduled_for, created_at, updated_at`,
    [
      title,
      description,
      status,
      mood,
      intent,
      outcome,
      dueDate,
      normalizedScheduledFor,
      taskId,
      req.session.userId,
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
