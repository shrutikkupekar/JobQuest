const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

async function getAuthHeader() {
  if (typeof window === 'undefined') return {};

  if (window.Clerk && !window.Clerk.session) {
    await new Promise((resolve) => {
      const interval = setInterval(() => {
        if (window.Clerk?.session) {
          clearInterval(interval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 3000);
    });
  }

  const token = await window.Clerk?.session?.getToken?.();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const authHeader = await getAuthHeader();
  const headers = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export const STATUSES = ['applied', 'interviewing', 'offer', 'rejected', 'followup'];
export const FOLLOWUP_TYPES = ['call', 'email', 'interview', 'other'];

export const api = {
  getMe: () => request('/api/me'),
  updateGoal: (weeklyGoal) =>
    request('/api/me', { method: 'PUT', body: JSON.stringify({ weekly_goal: weeklyGoal }) }),
  getDashboard: () => request('/api/dashboard'),
  listJobs: () => request('/api/jobs'),
  getJob: (id) => request(`/api/jobs/${id}`),
  createJob: (job) => request('/api/jobs', { method: 'POST', body: JSON.stringify(job) }),
  updateJob: (id, job) => request(`/api/jobs/${id}`, { method: 'PUT', body: JSON.stringify(job) }),
  deleteJob: (id) => request(`/api/jobs/${id}`, { method: 'DELETE' }),
  listFollowups: (id) => request(`/api/jobs/${id}/followups`),
  addFollowup: (id, f) =>
    request(`/api/jobs/${id}/followups`, { method: 'POST', body: JSON.stringify(f) }),
  listResumes: () => request('/api/resumes'),
  createResume: (resume) => request('/api/resumes', { method: 'POST', body: JSON.stringify(resume) }),
  deleteResume: (id) => request(`/api/resumes/${id}`, { method: 'DELETE' }),
};

// SQLite datetime('now') is UTC without a zone marker.
export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  return isNaN(d) ? value : d.toLocaleString();
}

export function formatRelativeDate(value) {
  if (!value) return '—';

  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;

  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(d);
}
