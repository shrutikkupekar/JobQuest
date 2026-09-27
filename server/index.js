require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'jobquest-local-dev-secret';

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (
      origin.endsWith('.vercel.app') ||
      origin === process.env.ALLOWED_ORIGIN ||
      origin === 'http://localhost:5173'
    ) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(express.json({ limit: '10mb' }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const STATUSES = ['applied', 'interviewing', 'offer', 'rejected', 'followup'];
const FOLLOWUP_TYPES = ['call', 'email', 'interview', 'other'];
const JOB_FIELDS = [
  'company',
  'role',
  'jd',
  'resume_used',
  'status',
  'applied_date',
  'salary_range',
  'job_url',
  'contact_name',
  'contact_email',
  'notes',
  'ats_score',
  'match_score',
];

function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
}

function authMiddleware(req, res, next) {
  const token = getAuthToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.userId) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = payload.userId;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function ensureUserProfile(userId) {
  const existing = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (existing) return existing;

  const nextId = Number(db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM users').get().next_id || 1);
  db.prepare(
    'INSERT INTO users (id, user_id, email, password_hash, created_at, xp, streak_days, last_active_date, weekly_goal) VALUES (?, ?, NULL, NULL, datetime(\'now\'), 0, 0, NULL, 5)'
  ).run(nextId, userId);
  return db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
}

function awardXp(userId, delta) {
  if (!delta) return { xpDelta: 0, xp: 0, streak_days: 0 };

  const user = ensureUserProfile(userId);
  const today = getTodayISO();
  const yesterday = getYesterdayISO();
  let streak = Number(user.streak_days || 0);

  if (user.last_active_date === today) {
    streak = streak;
  } else if (user.last_active_date === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }

  const xp = Number(user.xp || 0) + delta;
  db.prepare(
    'UPDATE users SET xp = ?, streak_days = ?, last_active_date = ? WHERE user_id = ?'
  ).run(xp, streak, today, userId);

  const updated = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  return { xpDelta: delta, xp: updated.xp, streak_days: updated.streak_days, weekly_goal: updated.weekly_goal };
}

function pickJobFields(body) {
  const out = {};
  for (const f of JOB_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

function validateJob(job, { partial }) {
  if (!partial || 'company' in job) {
    if (!job.company || !String(job.company).trim()) return 'company is required';
  }
  if (!partial || 'role' in job) {
    if (!job.role || !String(job.role).trim()) return 'role is required';
  }
  if (job.status != null && !STATUSES.includes(job.status)) {
    return `status must be one of: ${STATUSES.join(', ')}`;
  }
  return null;
}

function getJobForUser(userId, id) {
  return db.prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?').get(id, userId);
}

function getStartOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getStatsForUser(userId, jobs) {
  const total = jobs.length;
  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisWeek = jobs.filter((job) => {
    if (!job.last_updated) return false;
    const value = new Date(job.last_updated.replace(' ', 'T'));
    return value >= startOfWeek;
  }).length;

  const thisMonth = jobs.filter((job) => {
    if (!job.last_updated) return false;
    const value = new Date(job.last_updated.replace(' ', 'T'));
    return value >= monthStart;
  }).length;

  const response = jobs.filter((job) => job.status === 'interviewing' || job.status === 'offer').length;
  const responseRate = total ? (response / total) * 100 : 0;
  const user = ensureUserProfile(userId);

  return {
    thisWeek,
    thisMonth,
    allTime: total,
    responseRate,
    weeklyGoal: Number(user.weekly_goal || 5),
    goalProgress: thisWeek,
  };
}

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !password || String(password).length < 6) {
    return res.status(400).json({ error: 'Email and a password of at least 6 characters are required.' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered.' });
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const passwordHash = await bcrypt.hash(String(password), 10);
  const nextId = Number(db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM users').get().next_id || 1);

  db.prepare(
    'INSERT INTO users (id, user_id, email, password_hash, created_at, xp, streak_days, last_active_date, weekly_goal) VALUES (?, ?, ?, ?, datetime(\'now\'), 0, 0, NULL, 5)'
  ).run(nextId, userId, normalizedEmail, passwordHash);

  const token = createToken(userId);
  res.status(201).json({
    token,
    user: { id: userId, email: normalizedEmail },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const validPassword = await bcrypt.compare(String(password), user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = createToken(user.user_id);
  res.json({
    token,
    user: { id: user.user_id, email: user.email },
  });
});

app.use('/api', authMiddleware);

app.get('/api/me', (req, res) => {
  const profile = ensureUserProfile(req.userId);
  res.json(profile);
});

app.put('/api/me', (req, res) => {
  const nextGoal = Number(req.body?.weekly_goal);
  if (!Number.isFinite(nextGoal) || nextGoal < 1) {
    return res.status(400).json({ error: 'weekly_goal must be a positive number' });
  }

  db.prepare('UPDATE users SET weekly_goal = ? WHERE user_id = ?').run(nextGoal, req.userId);
  res.json(ensureUserProfile(req.userId));
});

app.get('/api/dashboard', (req, res) => {
  const jobs = db
    .prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY last_updated DESC, id DESC')
    .all(req.userId);

  res.json({
    user: ensureUserProfile(req.userId),
    jobs,
    stats: getStatsForUser(req.userId, jobs),
  });
});

app.get('/api/resumes', (req, res) => {
  const resumes = db
    .prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(req.userId);
  res.json(resumes);
});

app.post('/api/resumes', (req, res) => {
  const body = req.body || {};
  const resumeId = body.id || `${req.userId}-${Date.now()}`;
  const name = String(body.name || body.fileName || 'Resume').trim() || 'Resume';
  const fileName = String(body.fileName || 'resume.pdf').trim() || 'resume.pdf';
  const size = Number(body.size || 0);
  const type = String(body.type || 'application/pdf');
  const dataUrl = String(body.dataUrl || '').trim();

  if (!dataUrl) {
    return res.status(400).json({ error: 'Resume PDF is required' });
  }

  db.prepare(
    'INSERT INTO resumes (id, user_id, name, file_name, size, type, data_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
  ).run(resumeId, req.userId, name, fileName, Number.isFinite(size) ? size : 0, type, dataUrl);

  const created = db.prepare('SELECT * FROM resumes WHERE user_id = ? AND id = ?').get(req.userId, resumeId);
  res.status(201).json(created);
});

app.delete('/api/resumes/:id', (req, res) => {
  const info = db.prepare('DELETE FROM resumes WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Resume not found' });
  res.status(204).end();
});

app.get('/api/jobs', (req, res) => {
  const jobs = db
    .prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY last_updated DESC, id DESC')
    .all(req.userId);
  res.json(jobs);
});

app.get('/api/jobs/:id', (req, res) => {
  const job = getJobForUser(req.userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.post('/api/jobs', (req, res) => {
  const userId = req.userId;
  const job = pickJobFields(req.body || {});
  if (!job.status) job.status = 'applied';
  job.user_id = userId;
  const err = validateJob(job, { partial: false });
  if (err) return res.status(400).json({ error: err });

  const cols = Object.keys(job);
  const stmt = db.prepare(
    `INSERT INTO jobs (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`
  );
  const info = stmt.run(job);
  const created = getJobForUser(userId, info.lastInsertRowid);
  const xp = awardXp(userId, 10);
  res.status(201).json({ ...created, xpAward: { ...xp, xpDelta: 10 } });
});

app.put('/api/jobs/:id', (req, res) => {
  const existing = getJobForUser(req.userId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });

  const updates = pickJobFields(req.body || {});
  const err = validateJob(updates, { partial: true });
  if (err) return res.status(400).json({ error: err });

  const priorStatus = existing.status;
  const hasStatusChange = Object.prototype.hasOwnProperty.call(updates, 'status');
  const cols = Object.keys(updates);
  const sets = cols.map((c) => `${c} = @${c}`);
  sets.push("last_updated = datetime('now')");
  db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE id = @id AND user_id = @user_id`).run({
    ...updates,
    id: existing.id,
    user_id: req.userId,
  });

  const updated = getJobForUser(req.userId, existing.id);
  let xpAward = null;
  if (hasStatusChange && updates.status === 'interviewing' && priorStatus !== 'interviewing') {
    xpAward = awardXp(req.userId, 50);
  } else if (hasStatusChange && updates.status === 'offer' && priorStatus !== 'offer') {
    xpAward = awardXp(req.userId, 100);
  }

  res.json({
    ...updated,
    xpAward: xpAward
      ? { ...xpAward, xpDelta: xpAward.xpDelta || (updates.status === 'interviewing' ? 50 : 100) }
      : null,
  });
});

app.delete('/api/jobs/:id', (req, res) => {
  const info = db.prepare('DELETE FROM jobs WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (info.changes === 0) return res.status(404).json({ error: 'Job not found' });
  res.status(204).end();
});

app.get('/api/jobs/:id/followups', (req, res) => {
  const job = getJobForUser(req.userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const rows = db
    .prepare(
      'SELECT f.* FROM followups f WHERE f.job_id = ? AND EXISTS (SELECT 1 FROM jobs j WHERE j.id = f.job_id AND j.user_id = ?) ORDER BY f.date DESC, f.id DESC'
    )
    .all(req.params.id, req.userId);
  res.json(rows);
});

app.post('/api/jobs/:id/followups', (req, res) => {
  const job = getJobForUser(req.userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const { date, type, notes } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date is required' });
  if (!FOLLOWUP_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${FOLLOWUP_TYPES.join(', ')}` });
  }

  const addFollowup = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO followups (job_id, date, type, notes) VALUES (?, ?, ?, ?)')
      .run(job.id, date, type, notes || null);
    db.prepare("UPDATE jobs SET last_updated = datetime('now') WHERE id = ? AND user_id = ?").run(
      job.id,
      req.userId
    );
    return info.lastInsertRowid;
  });

  const id = addFollowup();
  const created = db
    .prepare(
      'SELECT f.* FROM followups f WHERE f.id = ? AND EXISTS (SELECT 1 FROM jobs j WHERE j.id = f.job_id AND j.user_id = ?)'
    )
    .get(id, req.userId);
  const xp = awardXp(req.userId, 15);
  res.status(201).json({ ...created, xpAward: { ...xp, xpDelta: 15 } });
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Job tracker API listening on port ${PORT}`);
});
