import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, STATUSES, formatDateTime, formatRelativeDate } from '../api.js';
import StatusSelect from '../components/StatusSelect.jsx';
import { showToast } from '../toast.js';

const COLUMNS = [
  { key: 'company', label: 'Company' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'applied_date', label: 'Applied' },
  { key: 'salary_range', label: 'Salary Range' },
  { key: 'last_updated', label: 'Last Updated' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 767);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState({
    thisWeek: 0,
    thisMonth: 0,
    allTime: 0,
    responseRate: 0,
    weeklyGoal: 5,
    goalProgress: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'last_updated', dir: 'desc' });
  const [goalInput, setGoalInput] = useState('5');
  const [editingGoal, setEditingGoal] = useState(false);

  function refreshDashboard() {
    api
      .getDashboard()
      .then((data) => {
        const nextJobs = data?.jobs || [];
        const nextStats = data?.stats || {};
        setJobs(nextJobs);
        setStats({
          thisWeek: nextStats.thisWeek || 0,
          thisMonth: nextStats.thisMonth || 0,
          allTime: nextStats.allTime || 0,
          responseRate: Number(nextStats.responseRate || 0),
          weeklyGoal: Number(nextStats.weeklyGoal || 5),
          goalProgress: Number(nextStats.goalProgress || 0),
        });
        setGoalInput(String(nextStats.weeklyGoal || 5));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refreshDashboard();

    const handleResize = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const counts = useMemo(() => {
    const c = { all: jobs.length };
    for (const s of STATUSES) c[s] = jobs.filter((j) => j.status === s).length;
    return c;
  }, [jobs]);

  const visible = useMemo(() => {
    const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);
    const { key, dir } = sort;
    return [...filtered].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      if (av === '' && bv !== '') return 1;
      if (bv === '' && av !== '') return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [jobs, filter, sort]);

  const goalPercent = Math.min(100, (stats.goalProgress / Math.max(1, stats.weeklyGoal)) * 100);

  function toggleSort(key) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  }

  async function changeStatus(job, status) {
    const prev = jobs;
    setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, status } : j)));
    try {
      const updated = await api.updateJob(job.id, { status });
      setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, ...updated } : j)));

      if (updated?.xpAward) {
        showToast(`+${updated.xpAward.xpDelta} XP`);
      } else {
        showToast('Status updated');
      }

      refreshDashboard();
    } catch (e) {
      setJobs(prev);
      setError(e.message);
    }
  }

  async function saveGoal() {
    const nextGoal = Number(goalInput);
    if (!Number.isFinite(nextGoal) || nextGoal < 1) {
      setError('Weekly goal must be at least 1.');
      return;
    }

    try {
      setError('');
      await api.updateGoal(nextGoal);
      setEditingGoal(false);
      refreshDashboard();
      showToast('Weekly goal updated');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1>Applications</h1>
          <Link to="/jobs/new" className="btn btn-primary">
            + Add Job
          </Link>
        </div>
        <div className="filters">
          {['all', ...STATUSES].map((s) => (
            <button
              key={s}
              className={`chip ${filter === s ? 'active' : ''}`}
              onClick={() => setFilter(s)}
            >
              {s} <span className="count">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">This week</span>
          <strong>{stats.thisWeek}</strong>
          <small>applications</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">This month</span>
          <strong>{stats.thisMonth}</strong>
          <small>applications</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">All time</span>
          <strong>{stats.allTime}</strong>
          <small>applications</small>
        </div>
        <div className="stat-card">
          <span className="stat-label">Response rate</span>
          <strong>{stats.responseRate.toFixed(0)}%</strong>
          <small>interviews + offers</small>
        </div>
        <div className="stat-card goal-card">
          <div className="goal-header">
            <span className="stat-label">Weekly goal</span>
            {!editingGoal ? (
              <button type="button" className="inline-edit" onClick={() => setEditingGoal(true)}>
                Edit
              </button>
            ) : null}
          </div>

          {editingGoal ? (
            <div className="goal-editor">
              <input
                type="number"
                min="1"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
              />
              <button type="button" className="btn btn-primary" onClick={saveGoal}>
                Save
              </button>
            </div>
          ) : (
            <>
              <strong>
                {stats.goalProgress} / {stats.weeklyGoal}
              </strong>
              <div className="progress-bar">
                <span style={{ width: `${goalPercent}%` }} />
              </div>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="empty">
          <div className="empty-illustration">🚀</div>
          <p>No applications yet — start your journey! 🚀</p>
          <button className="btn btn-primary" onClick={() => navigate('/jobs/new')}>
            Add your first job
          </button>
        </div>
      ) : isMobile ? (
        <div className="mobile-job-cards">
          {visible.map((job) => (
            <div key={job.id} className="mobile-job-card" onClick={() => navigate(`/jobs/${job.id}`)}>
              <div className="mobile-job-header">
                <div>
                  <div className="mobile-job-company">{job.company}</div>
                  <div className="mobile-job-role">{job.role}</div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <StatusSelect value={job.status} onChange={(s) => changeStatus(job, s)} />
                </div>
              </div>

              <div className="mobile-job-meta">
                <span><strong>Applied:</strong> {formatRelativeDate(job.applied_date)}</span>
                <span><strong>Salary:</strong> {job.salary_range || '—'}</span>
              </div>

              <div className="mobile-job-meta muted">
                <span><strong>Updated:</strong> {formatDateTime(job.last_updated)}</span>
              </div>
            </div>
          ))}
          {visible.length === 0 && <p className="muted center">No jobs with status “{filter}”.</p>}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="jobs-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} onClick={() => toggleSort(c.key)} className="sortable">
                    {c.label}
                    <span className="sort-indicator">
                      {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((job) => (
                <tr key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="clickable">
                  <td className="strong">{job.company}</td>
                  <td>{job.role}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <StatusSelect value={job.status} onChange={(s) => changeStatus(job, s)} />
                  </td>
                  <td>{formatRelativeDate(job.applied_date)}</td>
                  <td>{job.salary_range || '—'}</td>
                  <td className="muted">{formatDateTime(job.last_updated)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="muted center">
                    No jobs with status “{filter}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
