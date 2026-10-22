import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeToggle } from './components/ThemeToggle';
import { Disclaimer } from './components/Disclaimer';
import Dashboard from './pages/Dashboard';
import Signals from './pages/Signals';
import Backtest from './pages/Backtest';
import Compare from './pages/Compare';
import Diagnostics from './pages/Diagnostics';
import Optimise from './pages/Optimise';
import Methodology from './pages/Methodology';

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
      </main>
      <Disclaimer />
    </div>
  );
}
