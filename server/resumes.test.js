const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('./db');

test('resumes table persists user-scoped resume records', () => {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'resumes'")
    .get();

  assert.ok(table, 'resumes table should exist');

  const insert = db
    .prepare(
      'INSERT OR REPLACE INTO resumes (id, user_id, name, file_name, size, type, data_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      'resume-123',
      'user-abc',
      'My Resume',
      'my-resume.pdf',
      1024,
      'application/pdf',
      'data:application/pdf;base64,abc',
      new Date().toISOString()
    );

  const saved = db
    .prepare('SELECT * FROM resumes WHERE user_id = ? AND id = ?')
    .get('user-abc', 'resume-123');

  assert.equal(saved.name, 'My Resume');
  assert.equal(saved.file_name, 'my-resume.pdf');
  assert.equal(insert.changes, 1);
});
