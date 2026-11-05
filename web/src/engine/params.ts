/** Strategy parameters: defaults, presets and compact URL encoding. */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { AllocationParams } from './allocation';
import type { AssetParams } from './assets';
import type { BacktestParams } from './backtest';
import { COMPONENTS } from './components';
import type { RegimeParams, ScoreParams } from './score';

export interface BenchmarkParams {
  equity: 'SPX' | 'WORLD';
  bond: 'AGG' | 'IEF';
  /** Annualised vol target for the naive vol-targeting benchmark. */
  volTarget: number;
  volLookback: number;
}

export interface Params {
  score: ScoreParams;
  regime: RegimeParams;
  allocation: AllocationParams;
  assets: AssetParams;
  backtest: BacktestParams;
  period: { start: string; end: string; oosStart: string };
  benchmarks: BenchmarkParams;
}

/**
 * Reference parameters with every optional feature switched off: the Balanced
 * profile, and the defaults until 2026-10-23 (frozen in live track record v1).
 *
 * Frozen parameter files (data/track/vN/params.json) fill fields added after
 * they were frozen from BASE_PARAMS, so a new optional field must be "off" here
 * or it would silently change an existing track record.
 */
export const BASE_PARAMS: Params = {
  score: {
    method: 'percentile',
    window: 756,
    minPeriods: 252,
    minCoverage: 0.5,
    smoothing: 5,
    rerank: false,
    components: Object.fromEntries(
      COMPONENTS.map((c) => [c.id, { enabled: c.defaultEnabled, weight: c.defaultWeight || 1, invert: false, oneSided: false }]),
    ),
  },
  regime: {
    thresholds: [20, 40, 60, 80],
    hysteresis: 2.5,
    minHoldDays: 0,
    fastDerisk: true,
    // rule fixed before testing (2026-10-23): see METHODOLOGY 15
    rebound: { enabled: false, peak: 1.1, lookback: 20, normal: 1.0, hold: 20, toRegime: 2 },
    // rule fixed before testing (2026-10-23): see METHODOLOGY 15.5
    reentry: { enabled: false, offPeak: 0.8, peakDays: 20, normal: 1.0, maDays: 20, lowDays: 20, toRegime: 2 },
  },
  allocation: {
    mode: 'regime',
    adaptiveHedge: { enabled: false, lookback: 63, threshold: 0, replacement: 'BIL' },
    // v4 (docs/PREREG-v4.md): off here so frozen track records are unchanged
    defensiveTrend: { enabled: false, lookback: 252 },
    // v5 (docs/PREREG-v5.md): used only when mode = 'riskBudget'
    riskBudget: {
      targetVol: 0.12,
      volWindow: 21,
      trendWindow: 200,
      brake: 0.5,
      maxEquity: 1,
      equityAsset: 'SPX',
      bondAsset: 'IEF',
      cashAsset: 'BIL',
      hedgeLookback: 252,
      // candidate (docs/PREREG-v13.md): failed its pre-registered bar; on forward test as v4
      recessionGate: { enabled: false },
    },
    regimePortfolios: [
      { BIL: 1 }, // Crisis
      { IEF: 0.5, GLD: 0.25, XLU: 0.25 }, // Risk-Off
      { SPX: 0.6, IEF: 0.4 }, // Neutral
      { SPX: 1 }, // Risk-On
      { SSO: 1 }, // Strong Risk-On
    ],
    continuous: {
      scoreLow: 20,
      scoreHigh: 80,
      minEquity: 0,
      maxEquity: 1.5,
      equityAsset: 'SPX',
      leveragedAsset: 'SSO',
      defensive: { IEF: 0.5, GLD: 0.25, BIL: 0.25 },
    },
  },
  assets: { financingSpread: 0.0075, alwaysSynthetic: false },
  backtest: { lag: 1, rebalance: 'regime', band: 0.05, costBps: 5, assetCostBps: {} },
  period: { start: '2007-01-01', end: '', oosStart: '' },
  benchmarks: { equity: 'SPX', bond: 'AGG', volTarget: 0.12, volLookback: 21 },
};

/**
 * Growth: spends the drawdown savings on exposure (80/20 in Neutral, 125% equity
 * in Risk-On) and re-enters after panics (rebound override). Tested out of
 * sample in METHODOLOGY 15.4; the default since 2026-10-23 (track record v2).
 */
export const GROWTH_PATCH = {
  regime: { rebound: { enabled: true } },
  allocation: {
    regimePortfolios: [
      { BIL: 1 }, // Crisis
      { IEF: 0.5, GLD: 0.25, XLU: 0.25 }, // Risk-Off
      { SPX: 0.8, IEF: 0.2 }, // Neutral
      { SPX: 0.75, SSO: 0.25 }, // Risk-On
      { SSO: 1 }, // Strong Risk-On
    ],
  },
};

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

type Patch = { [k: string]: unknown };

/** Deep merge `patch` into a copy of `base` (arrays are replaced, not merged). */
export function merge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return clone(base);
  if (Array.isArray(base) || typeof base !== 'object' || base === null) {
    return clone(patch as T);
  }
  const out = clone(base) as Patch;
  if (typeof patch !== 'object' || patch === null) return out as T;
  for (const [k, v] of Object.entries(patch as Patch)) {
    out[k] = k in out ? merge(out[k], v) : clone(v);
  }
  return out as T;
}

export const DEFAULT_PARAMS: Params = merge(BASE_PARAMS, GROWTH_PATCH);

/**
 * v4 candidate (docs/PREREG-v4.md), applied on top of the defaults (Growth):
 * a trend pillar at half the weight (1-, 3- and 12-month S&P 500 returns plus
 * the 200-day trend), whole-history ranks, and a trend filter on defensive
 * holdings. Frozen before it was run; see METHODOLOGY §17 for the result.
 */
export const V4_PATCH = {
  score: {
    window: 0,
    components: {
      trend: { enabled: true, weight: 1.3125 },
      mom_1m: { enabled: true, weight: 1.3125 },
      mom_3m: { enabled: true, weight: 1.3125 },
      mom_12m: { enabled: true, weight: 1.3125 },
    },
  },
  allocation: { defensiveTrend: { enabled: true, lookback: 252 } },
};

/**
 * v5 risk budget (docs/PREREG-v5.md): passed its pre-registered test on 1927-1989
 * (METHODOLOGY §18). Equity sized by 12% / 21-day realised vol, halved below the
 * 200-day average; the rest in IEF while the stock-bond correlation is negative, else
 * T-bills; trades only when a weight is more than 10 points off target.
 */
export const V5_PATCH = {
  allocation: { mode: 'riskBudget' as const },
  backtest: { rebalance: 'daily' as const, band: 0.1 },
};

/**
 * Candidate: v5 with the recession gate (docs/PREREG-v13.md, METHODOLOGY §25). It added
 * return in both 1950-1989 and 1990-2026 but failed its pre-registered bar (bootstrap 77%
 * against 90%), so it is a forward test (live record v4), not a default.
 */
export const V13_PATCH = {
  allocation: { mode: 'riskBudget' as const, riskBudget: { recessionGate: { enabled: true } } },
  backtest: { rebalance: 'daily' as const, band: 0.1 },
};

/** Minimal patch p such that merge(base, p) deep-equals `value`. */
export function diff(base: unknown, value: unknown): unknown {
  if (JSON.stringify(base) === JSON.stringify(value)) return undefined;
  if (Array.isArray(value) || typeof value !== 'object' || value === null || typeof base !== 'object' || base === null) {
    return value;
  }
  const out: Patch = {};
  for (const [k, v] of Object.entries(value as Patch)) {
    const d = diff((base as Patch)[k], v);
    if (d !== undefined) out[k] = d;
  }
  return Object.keys(out).length ? out : undefined;
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  patch: unknown;
}

export const PRESETS: Preset[] = [
  {
    id: 'growth',
    label: 'Growth',
    description:
      'Defaults: 80/20 in neutral, 125% equity in risk-on, 2x S&P in strong risk-on, T-bills in crisis, plus the panic-rebound re-entry (Methodology 15.4).',
    patch: GROWTH_PATCH,
  },
  {
    id: 'riskbudget',
    label: 'Risk budget (v5)',
    description:
      'Simple rule, passed its pre-registered test on 1927-1989: equity = 12% / recent volatility (max 100%), halved below the 200-day average; rest in Treasuries when they hedge, else T-bills (Methodology 18).',
    patch: V5_PATCH,
  },
  {
    id: 'recessiongate',
    label: 'Risk budget + recession gate (candidate)',
    description:
      'Risk budget (v5), but the trend brake applies only while unemployment is above its 12-month average. Failed its pre-registered bar narrowly; on forward test as live record v4 (Methodology 25).',
    patch: V13_PATCH,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'The defaults until 2026-10-23 (live track record v1): 60/40 in neutral, 100% S&P in risk-on, no rebound re-entry.',
    patch: {},
  },
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'No leverage, slower signal (10-day smoothing, wider hysteresis), 40/60 in neutral.',
    patch: {
      score: { smoothing: 10 },
      regime: { hysteresis: 5 },
      allocation: {
        regimePortfolios: [
          { BIL: 0.7, GLD: 0.3 },
          { IEF: 0.5, BIL: 0.25, GLD: 0.25 },
          { SPX: 0.4, AGG: 0.6 },
          { SPX: 0.8, AGG: 0.2 },
          { SPX: 1 },
        ],
      },
    },
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description: 'Faster signal, leverage from risk-on upwards (3x in strong risk-on), equity-heavy neutral.',
    patch: {
      score: { smoothing: 3 },
      regime: { hysteresis: 1.5 },
      allocation: {
        regimePortfolios: [
          { BIL: 0.5, IEF: 0.5 },
          { SPX: 0.3, IEF: 0.5, GLD: 0.2 },
          { SPX: 1 },
          { SSO: 1 },
          { UPRO: 1 },
        ],
      },
    },
  },
  {
    id: 'continuous',
    label: 'Continuous',
    description: 'Equity exposure scales linearly with the score from 0% (score 20) to 150% (score 80).',
    patch: { allocation: { mode: 'continuous' }, backtest: { rebalance: 'weekly', band: 0.1 } },
  },
];

export function presetParams(id: string): Params {
  const p = PRESETS.find((x) => x.id === id);
  // presets are patches on the all-features-off base, not on the current defaults
  return merge(BASE_PARAMS, p?.patch ?? {});
}

/**
 * URL-safe compact encoding of the difference from the defaults. Since the
 * defaults changed on 2026-10-23, encodings carry `_v: 2`; older links and
 * saved profiles (no `_v`) were diffs from BASE_PARAMS and still decode to the
 * same settings.
 */
export function encodeParams(p: Params): string {
  const d = diff(DEFAULT_PARAMS, p);
  return d === undefined ? '' : compressToEncodedURIComponent(JSON.stringify({ ...(d as Patch), _v: 2 }));
}

export function decodeParams(s: string | null | undefined): Params {
  if (!s) return clone(DEFAULT_PARAMS);
  try {
    const json = decompressFromEncodedURIComponent(s);
    if (!json) return clone(DEFAULT_PARAMS);
    const { _v, ...patch } = JSON.parse(json) as Patch;
    return merge(_v === 2 ? DEFAULT_PARAMS : BASE_PARAMS, patch);
  } catch {
    return clone(DEFAULT_PARAMS);
  }
}
