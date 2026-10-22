import { lazy, Suspense } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loading } from './components/ui';

// pages load on demand: the first visit only downloads what it shows
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Signals = lazy(() => import('./pages/Signals'));
const Backtest = lazy(() => import('./pages/Backtest'));
const Diagnostics = lazy(() => import('./pages/Diagnostics'));
const Optimise = lazy(() => import('./pages/Optimise'));
const Compare = lazy(() => import('./pages/Compare'));
const Methodology = lazy(() => import('./pages/Methodology'));
import { ThemeToggle } from './components/ThemeToggle';
import { Disclaimer } from './components/Disclaimer';

const TABS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/signals', label: 'Signals' },
  { path: '/backtest', label: 'Backtest' },
  { path: '/diagnostics', label: 'Diagnostics' },
  { path: '/optimise', label: 'Optimise' },
  { path: '/compare', label: 'Compare' },
  { path: '/methodology', label: 'Methodology' },
] as const;

export default function App() {
  // keep the parameter query (?p=...) when switching tabs
  const { search } = useLocation();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" aria-hidden="true" />
          <span className="brand-name">VolStrat</span>
          <span className="brand-sub">Volatility-regime allocator</span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <NavLink key={t.path} to={{ pathname: t.path, search }} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <ThemeToggle />
      </header>
      <main className="content">
        <Suspense fallback={<Loading label="Loading page…" />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/backtest" element={<Backtest />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/optimise" element={<Optimise />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
      </main>
      <Disclaimer />
    </div>
  );
}
