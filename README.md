# Jobquest

A personal job application tracker.

- **Frontend:** Vite + React + React Router (`/client`)
- **Backend:** Express + SQLite via better-sqlite3 (`/server`, DB file at `server/data/jobs.db`)
- **Deploy:** frontend on Vercel, backend on Railway (from this one repo)

```
.
├── client/          # Vite + React app
├── server/          # Express API + SQLite
│   └── data/        # jobs.db is created here on first run
├── vercel.json      # Vercel build config (frontend)
└── railway.json     # Railway build/deploy config (backend)
```

## Local setup

Requires Node.js 18 or newer.

### 1. Create a Clerk app

1. Go to [clerk.com](https://clerk.com) and create a free account.
2. Create a new app in the Clerk dashboard.
3. In the app dashboard, open **API Keys** and copy:
   - the Publishable Key (starts with `pk_`)
   - the Secret Key (starts with `sk_`)
4. Put the keys in the local environment files below.

### 2. Backend

```bash
cd server
cp .env.example .env
npm install
npm run dev                 # or: npm start
```

Your `.env` file should include values like:

```bash
PORT=3001
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
CLERK_SECRET_KEY=sk_test_your_secret_key
```

The API runs at `http://localhost:3001`. The SQLite database and its tables are created automatically at `server/data/jobs.db` the first time the server starts.

### 3. Frontend

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Your `.env` file should include values like:

```bash
VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
```

Open `http://localhost:5173`.

### API

| Method | Route                       | Description                              |
| ------ | --------------------------- | ---------------------------------------- |
| GET    | `/api/jobs`                 | List all jobs (newest `last_updated` first) |
| GET    | `/api/jobs/:id`             | Get one job                              |
| POST   | `/api/jobs`                 | Create a job (`company` and `role` required) |
| PUT    | `/api/jobs/:id`             | Update a job (partial updates allowed)   |
| DELETE | `/api/jobs/:id`             | Delete a job and its follow-ups          |
| GET    | `/api/jobs/:id/followups`   | List follow-ups for a job                |
| POST   | `/api/jobs/:id/followups`   | Add a follow-up (`date`, `type`, `notes`) |

`status` is one of `applied`, `interviewing`, `offer`, `rejected`, `followup`.
Follow-up `type` is one of `call`, `email`, `interview`, `other`.

## Deploying the backend to Railway

Deploy the backend first, so you have its URL for the frontend.

1. Push this repo to GitHub.
2. In [Railway](https://railway.app), choose **New Project → Deploy from GitHub repo** and pick this repo.
   Railway reads `railway.json` at the repo root: it builds with Nixpacks and starts the API with
   `cd server && npm install && node index.js`, using `/api/jobs` as the health check.
3. **Add a volume so your data survives redeploys.** Railway's filesystem is wiped on every deploy, so without a volume
   the SQLite database is lost each time. Open the service, go to **Settings → Volumes → Add Volume**, and set the mount path to
   `/app/server/data`.
4. Under **Settings → Networking**, click **Generate Domain** to get a public URL such as
   `https://job-tracker-production.up.railway.app`.
5. Set environment variables (see below), which triggers a redeploy.

### Railway environment variables

Open the service's **Variables** tab and add:

| Variable         | Value                                             |
| ---------------- | ------------------------------------------------- |
| `ALLOWED_ORIGIN` | Your Vercel URL, e.g. `https://job-tracker.vercel.app` (no trailing slash). Separate multiple origins with commas. If unset, the API allows all origins (`*`). |
| `CLERK_PUBLISHABLE_KEY` | Your Clerk Publishable Key from the Clerk dashboard |
| `CLERK_SECRET_KEY` | Your Clerk Secret Key from the Clerk dashboard |

You don't need to set `PORT`: Railway provides it automatically.

## Deploying the frontend to Vercel

1. In [Vercel](https://vercel.com), choose **Add New → Project** and import the same GitHub repo.
2. Leave **Root Directory** as the repo root. Vercel reads `vercel.json`, which runs
   `cd client && npm install && npm run build`, serves `client/dist`, and rewrites every route to `index.html` so
   React Router links work when the page is refreshed.
3. Before the first deploy, set the environment variables below, then click **Deploy**.

### Vercel environment variables

Under **Project → Settings → Environment Variables**, add:

| Variable                     | Value                                                   |
| ---------------------------- | ------------------------------------------------------- |
| `VITE_API_URL`               | Your Railway backend URL, e.g. `https://job-tracker-production.up.railway.app` (no trailing slash) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Your Clerk Publishable Key from the Clerk dashboard |

Vite bakes `VITE_*` variables into the bundle at build time, so after changing these variables you must redeploy
(**Deployments → ⋯ → Redeploy**).

### Connecting the two

1. Deploy the backend to Railway and copy its URL.
2. Set `VITE_API_URL` on Vercel to that URL and deploy the frontend.
3. Copy the Vercel URL and set it as `ALLOWED_ORIGIN` on Railway.

## Notes

- `ats_score` and `match_score` exist in the schema but aren't used yet; they are `null` by default.
- The API uses Clerk authentication. Every request must be signed in and every job/follow-up lookup is scoped by the authenticated `userId`.
- The database includes a `user_id` column on `jobs`, and older databases are migrated automatically on startup if that column is missing.
