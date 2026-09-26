import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createStoredResume,
  deleteStoredResume,
  loadStoredResumes,
  readPdfFileAsDataUrl,
} from '../resumes.js';

export default function Resumes() {
  const [resumes, setResumes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const totalSize = useMemo(
    () => resumes.reduce((sum, resume) => sum + (resume.size || 0), 0),
    [resumes]
  );

  async function refreshResumes() {
    setLoading(true);
    const stored = await loadStoredResumes();
    setResumes(Array.isArray(stored) ? stored : []);
    setLoading(false);
  }

  useEffect(() => {
    refreshResumes();
  }, []);

  async function handleUpload(e) {
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
      setResumes((items) => [created, ...items.filter((resume) => resume.id !== created.id)]);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to add resume.');
    }
  }

  async function handleDelete(id) {
    const nextResumes = await deleteStoredResume(id);
    setResumes(nextResumes);
  }

  const safeResumes = resumes || [];

  return (
    <section>
      <div className="page-header">
        <div>
          <Link to="/" className="back">
            ← Back
          </Link>
          <h1>My Resumes</h1>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card resume-upload-card">
        <h2>Upload a PDF</h2>
        <label className="resume-upload-label">
          <input type="file" accept="application/pdf" onChange={handleUpload} />
          <span className="btn btn-primary">Choose PDF</span>
        </label>
        <p className="muted">Saved files stay in this browser for quick reuse in job applications.</p>
      </div>

      <div className="card">
        <div className="resume-summary">
          <h2>Saved Resumes</h2>
          <span className="resume-total">{safeResumes.length} file(s)</span>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : safeResumes.length === 0 ? (
          <p className="muted">No resumes saved yet.</p>
        ) : (
          <div className="resume-list">
            {(safeResumes || []).map((resume) => (
              <div key={resume.id} className="resume-item">
                <div className="resume-meta">
                  <strong>{resume.name}</strong>
                  <span className="muted">{resume.fileName}</span>
                  <span className="muted">{Math.max(1, Math.round((resume.size || 0) / 1024))} KB</span>
                </div>
                <div className="resume-actions">
                  <a className="btn" href={resume.dataUrl} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                  <button className="btn btn-danger-outline" onClick={() => handleDelete(resume.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {safeResumes.length > 0 && (
          <p className="muted resume-total-row">Total storage: {Math.max(1, Math.round(totalSize / 1024))} KB</p>
        )}
      </div>
    </section>
  );
}
