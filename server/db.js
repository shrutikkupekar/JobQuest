const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || './data/jobs.db';
console.log('SQLite database path:', dbPath);
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
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
      id               INTEGER,
      email            TEXT UNIQUE,
      password_hash    TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
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

  const tableInfo = db.prepare('PRAGMA table_info(jobs)').all();
  const hasUserId = tableInfo.some((column) => column.name === 'user_id');

  if (!hasUserId) {
    db.exec("ALTER TABLE jobs ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
    db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)');
  }

  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  const requiredUserColumns = [
    'user_id',
    'id',
    'email',
    'password_hash',
    'created_at',
    'xp',
    'streak_days',
    'last_active_date',
    'weekly_goal',
  ];

  const hasAllUserColumns = requiredUserColumns.every((columnName) =>
    userColumns.some((column) => column.name === columnName)
  );

  if (!hasAllUserColumns && userColumns.length) {
    const legacyColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
    db.exec('ALTER TABLE users RENAME TO users_legacy');
    db.exec(`
      CREATE TABLE users (
        user_id          TEXT PRIMARY KEY,
        id               INTEGER,
        email            TEXT UNIQUE,
        password_hash    TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        xp               INTEGER NOT NULL DEFAULT 0,
        streak_days      INTEGER NOT NULL DEFAULT 0,
        last_active_date TEXT,
        weekly_goal      INTEGER NOT NULL DEFAULT 5
      )
    `);

    const selectExpressions = requiredUserColumns.map((columnName) => {
      if (legacyColumns.includes(columnName)) return columnName;
      if (columnName === 'created_at') return "datetime('now') AS created_at";
      if (columnName === 'xp') return '0 AS xp';
      if (columnName === 'streak_days') return '0 AS streak_days';
      if (columnName === 'weekly_goal') return '5 AS weekly_goal';
      return 'NULL AS ' + columnName;
    });

    db.exec(
      `INSERT INTO users (${requiredUserColumns.join(', ')}) SELECT ${selectExpressions.join(', ')} FROM users_legacy`
    );
    db.exec('DROP TABLE users_legacy');
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');
}

initializeDatabase();

module.exports = db;
