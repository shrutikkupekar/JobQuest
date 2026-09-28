import { useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ApiProvider } from './ApiContext.jsx';
import { makeApi } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import JobForm from './pages/JobForm.jsx';
import JobDetail from './pages/JobDetail.jsx';
import Resumes from './pages/Resumes.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

function ProtectedRoute({ children, isAuthenticated }) {
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function AuthShell({ children }) {
  return (
    <section className="auth-shell">
      <div className="auth-card">{children}</div>
    </section>
  );
}

function getStoredToken() {
  return localStorage.getItem('jq_token') || sessionStorage.getItem('jq_token');
}

function persistToken(nextToken, shouldRemember) {
  localStorage.removeItem('jq_token');
  sessionStorage.removeItem('jq_token');
  localStorage.setItem('jq_remember_me', shouldRemember ? 'true' : 'false');

  if (shouldRemember) {
    localStorage.setItem('jq_token', nextToken);
  } else {
    sessionStorage.setItem('jq_token', nextToken);
  }
}

function clearStoredToken() {
  localStorage.removeItem('jq_token');
  sessionStorage.removeItem('jq_token');
  localStorage.removeItem('jq_remember_me');
}

function getLevelLabel(level) {
  if (level >= 10) return 'Legend';
  if (level >= 6) return 'Pro';
  if (level >= 3) return 'Hustler';
  if (level >= 1) return 'Active';
  return 'Rookie';
}

function MobileNavIcon({ type }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  if (type === 'dashboard') {
    return (
      <svg {...common}>
        <path d="M4 13.5h6V20H4zm10-9h6V20h-6zm-10-3h6V8H4zm10 7h6v5h-6z" />
      </svg>
    );
  }

  if (type === 'logout') {
    return (
      <svg {...common}>
        <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" />
      </svg>
    );
  }

  if (type === 'add') {
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M5 18V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V18M8 10h8M8 14h5" />
      <path d="M18 18l2 2 4-4" />
    </svg>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState(() => getStoredToken());
  const [theme, setTheme] = useState(() => localStorage.getItem('job-tracker-theme') || 'dark');
  const [profile, setProfile] = useState(null);
  const [toasts, setToasts] = useState([]);

  const api = useMemo(
    () => makeApi(async () => getStoredToken()),
    [token]
  );
  const isAuthenticated = Boolean(token);
  const greeting = profile?.email || 'there';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('job-tracker-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      return;
    }

    api
      .getMe()
      .then(setProfile)
      .catch(() => {
        clearStoredToken();
        setToken(null);
        setProfile(null);
      });
  }, [token, api]);

  useEffect(() => {
    const onToast = (event) => {
      const { message, tone = 'info' } = event.detail || {};
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((items) => [...items, { id, message, tone }]);
      window.setTimeout(() => {
        setToasts((items) => items.filter((item) => item.id !== id));
      }, 3000);
    };

    window.addEventListener('jobtracker:toast', onToast);
    return () => window.removeEventListener('jobtracker:toast', onToast);
  }, []);

  const xp = Number(profile?.xp || 0);
  const level = Math.floor(xp / 100);
  const levelProgress = xp % 100;
  const progressPercent = (levelProgress / 100) * 100;
  const levelName = getLevelLabel(level);

  const handleMobileStatsClick = () => {
    window.requestAnimationFrame(() => {
      const stats = document.querySelector('.stats-grid');
      if (stats) {
        stats.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  };

  const handleLogout = () => {
    clearStoredToken();
    setToken(null);
    setProfile(null);
    navigate('/login');
  };

  return (
    <ApiProvider api={api}>
      <div className="app-shell">
        <header className="topbar">
          <NavLink to="/" className="brand">
            Jobquest
          </NavLink>

          {isAuthenticated && (
            <div className="topbar-center">
              <div className="xp-cluster">
                <div className="xp-meta">
                  <span>Level {level}</span>
                  <span>· {xp} XP</span>
                  <span>· {levelName}</span>
                </div>
                <div className="xp-bar">
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
              <div className="streak-badge">🔥 {profile?.streak_days || 0}</div>
            </div>
          )}

          <div className="topbar-right">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {isAuthenticated ? (
              <div className="user-menu">
                <span className="user-greeting">Hi {greeting}</span>
                <button type="button" className="btn btn-primary" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <NavLink to="/login" className="btn btn-primary">
                Sign in
              </NavLink>
            )}
          </div>
        </header>

        <main className="content">
          <Routes>
            <Route
              path="/login"
              element={
                isAuthenticated ? (
                  <Navigate to="/" replace />
                ) : (
                  <AuthShell>
                    <Login
                      onAuth={(nextToken, shouldRemember = true) => {
                        persistToken(nextToken, shouldRemember);
                        setToken(nextToken);
                      }}
                    />
                  </AuthShell>
                )
              }
            />
            <Route
              path="/signup"
              element={
                isAuthenticated ? (
                  <Navigate to="/" replace />
                ) : (
                  <AuthShell>
                    <Signup
                      onAuth={(nextToken, shouldRemember = true) => {
                        persistToken(nextToken, shouldRemember);
                        setToken(nextToken);
                      }}
                    />
                  </AuthShell>
                )
              }
            />
            <Route path="/" element={<ProtectedRoute isAuthenticated={isAuthenticated}><Dashboard key={location.pathname} /></ProtectedRoute>} />
            <Route path="/resumes" element={<ProtectedRoute isAuthenticated={isAuthenticated}><Resumes /></ProtectedRoute>} />
            <Route path="/jobs/new" element={<ProtectedRoute isAuthenticated={isAuthenticated}><JobForm /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute isAuthenticated={isAuthenticated}><JobDetail /></ProtectedRoute>} />
            <Route path="/jobs/:id/edit" element={<ProtectedRoute isAuthenticated={isAuthenticated}><JobForm /></ProtectedRoute>} />
            <Route path="*" element={<p className="muted">Page not found.</p>} />
          </Routes>
        </main>

        {isAuthenticated && (
          <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
            <NavLink to="/" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`} end>
              <MobileNavIcon type="dashboard" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/jobs/new" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
              <MobileNavIcon type="add" />
              <span>Add Job</span>
            </NavLink>
            <NavLink to="/" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`} onClick={handleMobileStatsClick}>
              <MobileNavIcon type="stats" />
              <span>Stats</span>
            </NavLink>
            <button
              type="button"
              className="mobile-nav-item"
              onClick={() => {
                if (window.confirm('Log out of Jobquest?')) handleLogout();
              }}
            >
              <MobileNavIcon type="logout" />
              <span>Log out</span>
            </button>
          </nav>
        )}

        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.tone}`}>
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </ApiProvider>
  );
}
