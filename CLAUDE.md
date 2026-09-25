# Job Tracker: project context

Personal job application tracker. One repo; the frontend deploys to Vercel and the backend to Railway.
The user-facing setup and deploy guide is in `README.md`. This file covers current state and conventions.

## Stack & layout

```
client/                 Vite + React 18 + React Router 6, plain CSS (dark theme)
  src/api.js            fetch wrapper; base URL = VITE_API_URL (default http://localhost:3001)
                        also exports STATUSES, FOLLOWUP_TYPES, formatDateTime()
  src/App.jsx           routes: /  /jobs/new  /jobs/:id  /jobs/:id/edit
  src/pages/Dashboard.jsx   table: sortable columns, status filter chips, inline status dropdown, row click → detail
  src/pages/JobForm.jsx     add + edit (same component, edit mode when :id present)
  src/pages/JobDetail.jsx   all fields, follow-up log with inline add form, delete with in-page confirm
  src/components/StatusSelect.jsx
  src/index.css         all styles; CSS variables in :root
server/                 Express 4 + better-sqlite3 (CommonJS)
  index.js              all routes, CORS, validation
  db.js                 opens server/data/jobs.db, creates tables if missing (no migration system)
  data/                 jobs.db lives here (gitignored); .gitkeep keeps the dir
vercel.json             builds client/, serves client/dist, SPA rewrite to /index.html
railway.json            Nixpacks; start = cd server && npm install && node index.js; healthcheck /api/jobs
```

The empty `backend/` and `frontend/` folders are leftovers from before this build and are unused. They're safe to delete.

## Data model

- **jobs:** id, company*, role*, jd, resume_used, status, applied_date, last_updated (auto), salary_range, job_url,
  contact_name, contact_email, notes, ats_score, match_score. (* = required)
  - `status` ∈ applied | interviewing | offer | rejected | followup (CHECK constraint, default `applied`)
  - `ats_score`, `match_score` are REAL, always null for now (reserved for a future feature)
  - `last_updated` is SQLite `datetime('now')` (UTC, no `Z`). `formatDateTime()` in the client handles that.
- **followups:** id, job_id → jobs.id (ON DELETE CASCADE), date, type ∈ call | email | interview | other, notes

## API

| Method | Route | Notes |
|---|---|---|
| GET | /api/jobs | sorted by last_updated DESC |
| GET | /api/jobs/:id | added beyond the original spec; used by detail/edit pages |
| POST | /api/jobs | 400 if company/role missing or status invalid |
| PUT | /api/jobs/:id | partial update; only whitelisted fields; always bumps last_updated |
| DELETE | /api/jobs/:id | 204; cascades follow-ups |
| GET | /api/jobs/:id/followups | sorted by date DESC |
| POST | /api/jobs/:id/followups | requires date + valid type; also bumps the job's last_updated |

Empty strings from the form are stored as NULL. When adding a new job column, update the schema in `db.js`,
`JOB_FIELDS` in `server/index.js`, `EMPTY` in `JobForm.jsx`, and the detail page. The table is created with
`CREATE TABLE IF NOT EXISTS`, so an existing `jobs.db` needs an `ALTER TABLE` (or delete the local db).

## Env vars

| Where | Var | Purpose |
|---|---|---|
| server | PORT | defaults to 3001 (Railway sets it automatically) |
| server | ALLOWED_ORIGIN | CORS origin(s), comma-separated; defaults to `*` |
| client | VITE_API_URL | backend base URL, no trailing slash; baked in at build time |

## Running locally

```bash
# terminal 1
cd server && cp .env.example .env && npm install && npm run dev    # http://localhost:3001

# terminal 2
cd client && cp .env.example .env && npm install && npm run dev    # http://localhost:5173
```

The client production build is `cd client && npm run build`. There are no tests or linter yet.

## Current status (as of 2026-09-24)

Done and verified:
- The client production build succeeds.
- Every API route was tested with curl: create, update, validation errors, follow-ups, sort order, delete cascade,
  and CORS both with `*` and with a specific origin.

Not done yet:
- **The UI hasn't been tested in a browser.** Nobody has clicked through the pages yet, so do that first.
- **Git isn't initialized and nothing is pushed.** The user will need a GitHub repo before deploying.
- **Not deployed** to Vercel or Railway.

## Known risks / next steps

1. **Railway data persistence:** Railway's filesystem is wiped on each deploy. Mount a Railway volume at
   `/app/server/data` or the SQLite db is lost every redeploy. The README covers this.
2. **No authentication:** anyone with the Railway URL can read and change data, and CORS doesn't prevent that.
   A simple option is a shared-secret `API_KEY` env var checked in middleware, sent from the client as a header.
3. Possible features: fill in `ats_score` / `match_score` (for example, score the JD against resume_used), edit and delete
   follow-ups (there's no API for either yet), search, CSV export, and stats by status.
4. Housekeeping: run `git init` and make the first commit, delete the empty `backend/` and `frontend/` folders, and optionally
   add ESLint and tests.
