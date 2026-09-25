const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'jobs.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const tableInfo = db.prepare('PRAGMA table_info(jobs)').all();
const hasUserId = tableInfo.some((column) => column.name === 'user_id');

if (!hasUserId) {
  db.exec("ALTER TABLE jobs ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT NOT NULL DEFAULT '',
    company       TEXT NOT NULL,
    role          TEXT NOT NULL,
    jd            TEXT,
    resume_used   TEXT,
    status        TEXT NOT NULL DEFAULT 'applied'
                  CHECK (status IN ('applied','interviewing','offer','rejected','followup')),
    applied_date  TEXT,
    last_updated  TEXT NOT NULL DEFAULT (datetime('now')),
    salary_range  TEXT,
    job_url       TEXT,
    contact_name  TEXT,
    contact_email TEXT,
    notes         TEXT,
    ats_score     REAL,
    match_score   REAL
  );

  CREATE TABLE IF NOT EXISTS followups (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id  INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    date    TEXT NOT NULL,
    type    TEXT NOT NULL CHECK (type IN ('call','email','interview','other')),
    notes   TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    user_id          TEXT PRIMARY KEY,
    xp               INTEGER NOT NULL DEFAULT 0,
    streak_days      INTEGER NOT NULL DEFAULT 0,
    last_active_date TEXT,
    weekly_goal      INTEGER NOT NULL DEFAULT 5
  );

  CREATE TABLE IF NOT EXISTS resumes (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    name       TEXT NOT NULL,
    file_name  TEXT NOT NULL,
    size       INTEGER NOT NULL DEFAULT 0,
    type       TEXT NOT NULL DEFAULT 'application/pdf',
    data_url   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
  CREATE INDEX IF NOT EXISTS idx_followups_job_id ON followups(job_id);
  CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
`);

const jobsColumns = db.prepare('PRAGMA table_info(jobs)').all();
if (!jobsColumns.some((column) => column.name === 'user_id')) {
  db.exec("ALTER TABLE jobs ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)');
}

const userColumns = db.prepare('PRAGMA table_info(users)').all();
if (!userColumns.length) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id          TEXT PRIMARY KEY,
      xp               INTEGER NOT NULL DEFAULT 0,
      streak_days      INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT,
      weekly_goal      INTEGER NOT NULL DEFAULT 5
    );
  `);
}

module.exports = db;
