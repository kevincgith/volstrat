import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'volstrat.theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // storage unavailable (private mode etc.) – fall through to system preference
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // non-critical
    }
  }, [theme]);

  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button className="icon-btn" onClick={() => setTheme(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
