import { useEffect, useMemo, useState } from 'react';
import {
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import JobForm from './pages/JobForm.jsx';
import JobDetail from './pages/JobDetail.jsx';
import Resumes from './pages/Resumes.jsx';

function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) return <p className="muted">Loading…</p>;
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
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
  const { user } = useUser();
  const greeting = user?.firstName || user?.fullName || 'there';
  const [theme, setTheme] = useState(() => localStorage.getItem('job-tracker-theme') || 'dark');
  const [profile, setProfile] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('job-tracker-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    api
      .getMe()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [user]);

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

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          Jobquest
        </NavLink>

        <SignedIn>
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
        </SignedIn>

        <div className="topbar-right">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <SignedIn>
            <div className="user-menu">
              <span className="user-greeting">Hi {greeting}</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>

          <SignedOut>
            <NavLink to="/sign-in" className="btn btn-primary">
              Sign in
            </NavLink>
          </SignedOut>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route
            path="/sign-in/*"
            element={
              <>
                <SignedIn>
                  <Navigate to="/" replace />
                </SignedIn>
                <SignedOut>
                  <AuthShell>
                    <SignIn
                      routing="path"
                      path="/sign-in"
                      signUpUrl="/sign-up"
                      afterSignInUrl="/"
                      redirectUrl="/"
                    />
                  </AuthShell>
                </SignedOut>
              </>
            }
          />
          <Route
            path="/sign-up/*"
            element={
              <>
                <SignedIn>
                  <Navigate to="/" replace />
                </SignedIn>
                <SignedOut>
                  <AuthShell>
                    <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" afterSignUpUrl="/" />
                  </AuthShell>
                </SignedOut>
              </>
            }
          />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/resumes" element={<ProtectedRoute><Resumes /></ProtectedRoute>} />
          <Route path="/jobs/new" element={<ProtectedRoute><JobForm /></ProtectedRoute>} />
          <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
          <Route path="/jobs/:id/edit" element={<ProtectedRoute><JobForm /></ProtectedRoute>} />
          <Route path="*" element={<p className="muted">Page not found.</p>} />
        </Routes>
      </main>

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
      </nav>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
