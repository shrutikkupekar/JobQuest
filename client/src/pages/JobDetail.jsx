import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, FOLLOWUP_TYPES, formatDateTime, formatRelativeDate } from '../api.js';
import StatusSelect from '../components/StatusSelect.jsx';
import { getResumeById } from '../resumes.js';
import { showToast } from '../toast.js';

const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, children }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="field-value">{children || <span className="muted">—</span>}</div>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newFollowup, setNewFollowup] = useState({ date: today(), type: 'email', notes: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([api.getJob(id), api.listFollowups(id)])
      .then(([j, f]) => {
        setJob(j);
        setFollowups(f);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  async function changeStatus(status) {
    try {
      const updated = await api.updateJob(id, { status });
      setJob(updated);
      if (updated?.xpAward) {
        showToast(`+${updated.xpAward.xpDelta} XP`);
      } else {
        showToast('Status updated');
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete() {
    try {
      await api.deleteJob(id);
      navigate('/');
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleAddFollowup(e) {
    e.preventDefault();
    setAdding(true);
    try {
      const created = await api.addFollowup(id, newFollowup);
      setFollowups((fs) =>
        [created, ...fs].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      );
      setNewFollowup({ date: today(), type: 'email', notes: '' });
      setJob(await api.getJob(id));
      showToast('Followup added');
      if (created?.xpAward) {
        showToast(`+${created.xpAward.xpDelta} XP`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  if (error && !job) return <div className="error">{error}</div>;
  if (!job) return <p className="muted">Loading…</p>;

  const selectedResume = getResumeById(job.resume_used);

  return (
    <section>
      <div className="page-header">
        <div>
          <Link to="/" className="back">
            ← Back
          </Link>
          <h1>
            {job.role} <span className="muted">at</span> {job.company}
          </h1>
        </div>
        <div className="actions">
          <StatusSelect value={job.status} onChange={changeStatus} />
          <Link to={`/jobs/${id}/edit`} className="btn">
            Edit
          </Link>
          {confirmDelete ? (
            <>
              <button className="btn btn-danger" onClick={handleDelete}>
                Confirm delete
              </button>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-danger-outline" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="grid">
          <Field label="Applied">{formatRelativeDate(job.applied_date)}</Field>
          <Field label="Salary Range">{job.salary_range}</Field>
          <Field label="Job URL">
            {job.job_url && (
              <a href={job.job_url} target="_blank" rel="noreferrer">
                {job.job_url}
              </a>
            )}
          </Field>
          <Field label="Last Updated">{formatDateTime(job.last_updated)}</Field>
          <Field label="Contact">{job.contact_name}</Field>
          <Field label="Contact Email">
            {job.contact_email && <a href={`mailto:${job.contact_email}`}>{job.contact_email}</a>}
          </Field>
          <Field label="ATS Score">{job.ats_score != null && String(job.ats_score)}</Field>
          <Field label="Match Score">{job.match_score != null && String(job.match_score)}</Field>
        </div>
      </div>

      {job.notes && (
        <div className="card">
          <h2>Notes</h2>
          <p className="pre">{job.notes}</p>
        </div>
      )}

      <div className="card">
        <h2>Follow-ups</h2>
        <form className="followup-form" onSubmit={handleAddFollowup}>
          <input
            type="date"
            value={newFollowup.date}
            onChange={(e) => setNewFollowup((f) => ({ ...f, date: e.target.value }))}
            required
          />
          <select
            value={newFollowup.type}
            onChange={(e) => setNewFollowup((f) => ({ ...f, type: e.target.value }))}
          >
            {FOLLOWUP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className="grow"
            placeholder="Notes"
            value={newFollowup.notes}
            onChange={(e) => setNewFollowup((f) => ({ ...f, notes: e.target.value }))}
          />
          <button type="submit" className="btn btn-primary" disabled={adding}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>

        {followups.length === 0 ? (
          <p className="muted">No follow-ups logged yet.</p>
        ) : (
          <ul className="followup-list">
            {followups.map((f) => (
              <li key={f.id}>
                <span className="followup-date">{f.date}</span>
                <span className={`tag tag-${f.type}`}>{f.type}</span>
                <span className="pre">{f.notes}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {job.jd && (
        <div className="card">
          <h2>Job Description</h2>
          <p className="pre">{job.jd}</p>
        </div>
      )}

      {(job.resume_used || selectedResume) && (
        <div className="card">
          <h2>Resume Used</h2>
          {selectedResume ? (
            <div className="resume-preview">
              <strong>{selectedResume.name}</strong>
              <span className="muted">{selectedResume.fileName}</span>
              <a href={selectedResume.dataUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </div>
          ) : (
            <p className="pre">{job.resume_used}</p>
          )}
        </div>
      )}
    </section>
  );
}
