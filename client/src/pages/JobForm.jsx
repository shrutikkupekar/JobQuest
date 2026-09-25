import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, STATUSES } from '../api.js';
import {
  createStoredResume,
  getResumeById,
  loadStoredResumes,
  readPdfFileAsDataUrl,
} from '../resumes.js';
import { showToast } from '../toast.js';

const EMPTY = {
  company: '',
  role: '',
  status: 'applied',
  applied_date: new Date().toISOString().slice(0, 10),
  salary_range: '',
  job_url: '',
  contact_name: '',
  contact_email: '',
  jd: '',
  resume_used: '',
  notes: '',
};

export default function JobForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedResumes, setSavedResumes] = useState([]);

  const selectedResume = useMemo(
    () => getResumeById(form.resume_used) || null,
    [form.resume_used]
  );

  useEffect(() => {
    async function loadResumes() {
      const resumes = await loadStoredResumes();
      setSavedResumes(resumes);
    }

    loadResumes();
    if (!isEdit) return;
    api
      .getJob(id)
      .then((job) => {
        const next = { ...EMPTY };
        for (const k of Object.keys(EMPTY)) next[k] = job[k] ?? '';
        setForm(next);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleResumeUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await readPdfFileAsDataUrl(file);
      const nextResume = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.pdf$/i, '') || 'Resume',
        fileName: file.name,
        size: file.size,
        type: 'application/pdf',
        dataUrl,
        createdAt: new Date().toISOString(),
      };
      const created = await createStoredResume(nextResume);
      setSavedResumes((items) => [created, ...items.filter((resume) => resume.id !== created.id)]);
      setForm((f) => ({ ...f, resume_used: created.id }));
    } catch (err) {
      setError(err.message || 'Unable to upload resume.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = isEdit ? await api.updateJob(id, form) : await api.createJob(form);
      showToast(isEdit ? 'Job saved' : 'Job saved');
      if (saved?.xpAward) {
        showToast(`+${saved.xpAward.xpDelta} XP`);
      }
      navigate(`/jobs/${saved.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <section>
      <div className="page-header">
        <h1>{isEdit ? 'Edit Job' : 'Add Job'}</h1>
      </div>

      {error && <div className="error">{error}</div>}

      <form className="job-form card" onSubmit={handleSubmit}>
        <div className="grid">
          <label>
            Company *
            <input value={form.company} onChange={set('company')} required autoFocus />
          </label>
          <label>
            Role *
            <input value={form.role} onChange={set('role')} required />
          </label>
          <label>
            Status
            <select value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Applied Date
            <input type="date" value={form.applied_date} onChange={set('applied_date')} />
          </label>
          <label>
            Salary Range
            <input
              value={form.salary_range}
              onChange={set('salary_range')}
              placeholder="e.g. $120k–$150k"
            />
          </label>
          <label>
            Job URL
            <input
              type="url"
              value={form.job_url}
              onChange={set('job_url')}
              placeholder="https://"
            />
          </label>
          <label>
            Contact Name
            <input value={form.contact_name} onChange={set('contact_name')} />
          </label>
          <label>
            Contact Email
            <input type="email" value={form.contact_email} onChange={set('contact_email')} />
          </label>
        </div>

        <label>
          Job Description
          <textarea rows={8} value={form.jd} onChange={set('jd')} />
        </label>
        <div className="resume-field card subcard">
          <div className="resume-field-header">
            <label className="resume-select-label">
              Resume Used
              <select value={form.resume_used || ''} onChange={set('resume_used')}>
                <option value="">No resume selected</option>
                {savedResumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="resume-upload-label compact">
              <input type="file" accept="application/pdf" onChange={handleResumeUpload} />
              <span className="btn btn-primary">Upload PDF</span>
            </label>
          </div>

          {selectedResume ? (
            <div className="resume-preview">
              <strong>{selectedResume.name}</strong>
              <span className="muted">{selectedResume.fileName}</span>
              <a href={selectedResume.dataUrl} target="_blank" rel="noreferrer">
                Open PDF
              </a>
            </div>
          ) : (
            <p className="muted">Upload a PDF or choose a saved resume for this application.</p>
          )}
        </div>
        <label>
          Notes
          <textarea rows={4} value={form.notes} onChange={set('notes')} />
        </label>

        <div className="actions">
          <Link to={isEdit ? `/jobs/${id}` : '/'} className="btn">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job'}
          </button>
        </div>
      </form>
    </section>
  );
}
