/**
 * Chart colours: the validated reference palette (dataviz skill), fixed slot
 * order, with selected dark-mode steps. Regimes use a diverging blue<->red
 * scale with a grey midpoint (polarity, not identity).
 */
import type { Theme } from '../theme';

const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

const CHROME = {
  light: { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', neutral: '#f0efec' },
  dark: { surface: '#121a25', ink: '#f0efec', ink2: '#c3c2b7', muted: '#898781', grid: '#253244', axis: '#3a4658', neutral: '#383835' },
};

/** Crisis -> Strong Risk-On. */
const REGIME = {
  light: ['#d03b3b', '#ec9a8f', '#b9b8b2', '#86b6ef', '#256abf'],
  dark: ['#e66767', '#a8524c', '#5c5c58', '#3c6ea8', '#6da7ec'],
};

/** Translucent regime fills for background shading. */
const REGIME_FILL = {
  light: ['rgba(208,59,59,0.20)', 'rgba(236,131,90,0.14)', 'rgba(0,0,0,0)', 'rgba(42,120,214,0.08)', 'rgba(42,120,214,0.18)'],
  dark: ['rgba(230,103,103,0.22)', 'rgba(217,89,38,0.14)', 'rgba(0,0,0,0)', 'rgba(57,135,229,0.10)', 'rgba(57,135,229,0.22)'],
};

export function colors(theme: Theme) {
  return {
    series: CATEGORICAL[theme],
    regime: REGIME[theme],
    regimeFill: REGIME_FILL[theme],
    ...CHROME[theme],
    /** Diverging ends for return heatmaps (negative, positive). */
    neg: theme === 'light' ? '#d03b3b' : '#e66767',
    pos: theme === 'light' ? '#2a78d6' : '#3987e5',
  };
}

export type Colors = ReturnType<typeof colors>;

/** Stable colour per portfolio/series id (colour follows the entity). */
const ENTITY_SLOT: Record<string, number> = {
  strategy: 0,
  spx: 1,
  world: 2,
  '80/20': 3,
  '60/40': 4,
  '40/60': 5,
  voltarget: 6,
};
export function entityColor(c: Colors, id: string, fallback = 7): string {
  return c.series[ENTITY_SLOT[id] ?? fallback]!;
}

/** Stable colour per asset in allocation charts. */
const ASSET_SLOT: Record<string, number> = { SPX: 0, SSO: 6, UPRO: 7, WORLD: 2, IEF: 1, TLT: 4, AGG: 3, SHY: 5, BIL: 2, GLD: 3, XLU: 5 };
export function assetColor(c: Colors, key: string): string {
  return c.series[ASSET_SLOT[key] ?? 7]!;
}
