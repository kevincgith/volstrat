import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeToggle } from './components/ThemeToggle';
import { Disclaimer } from './components/Disclaimer';
import Dashboard from './pages/Dashboard';
import Signals from './pages/Signals';
import Backtest from './pages/Backtest';
import Compare from './pages/Compare';
import Methodology from './pages/Methodology';

const TABS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/signals', label: 'Signals' },
  { path: '/backtest', label: 'Backtest' },
  { path: '/compare', label: 'Compare' },
  { path: '/methodology', label: 'Methodology' },
] as const;

export default function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">VolStrat</span>
          <span className="brand-sub">Volatility-regime allocator</span>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <NavLink key={t.path} to={t.path} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
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
          <Route path="/compare" element={<Compare />} />
          <Route path="/methodology" element={<Methodology />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <Disclaimer />
    </div>
  );
}
