/**
 * Mapping from score / regime to target portfolio weights.
 *
 * Regime mode: each of the five regimes has a user-defined portfolio.
 * Continuous mode: equity exposure moves linearly with the score between
 * (scoreLow, minEquity) and (scoreHigh, maxEquity). Exposure above 100% is
 * built by blending the S&P 500 ETF with the chosen leveraged ETF; the
 * remainder is held in the defensive mix.
 */

import { EQUITY_ASSETS, LEVERAGE, type AssetKey } from './assets';

export type Weights = Partial<Record<AssetKey, number>>;

export interface AdaptiveHedge {
  enabled: boolean;
  /** Trailing window (trading days) for the stock-bond correlation. */
  lookback: number;
  /** Swap duration out when the correlation is above this level. */
  threshold: number;
  /** Asset that replaces duration (IEF, TLT, AGG) while the swap is on. */
  replacement: AssetKey;
}

export const DURATION_ASSETS: AssetKey[] = ['IEI', 'IEF', 'TLH', 'TLT', 'TIP', 'AGG'];

/** Replace duration assets by `to` (weights merged); returns the input when nothing changes. */
export function swapDuration(w: Weights, to: AssetKey): Weights {
  if (!DURATION_ASSETS.some((k) => (w[k] ?? 0) > 0)) return w;
  const out: Weights = {};
  for (const [k, v] of Object.entries(w)) {
    const key = (DURATION_ASSETS.includes(k as AssetKey) ? to : k) as AssetKey;
    out[key] = (out[key] ?? 0) + (v ?? 0);
  }
  return out;
}

export interface AllocationParams {
  mode: 'regime' | 'continuous';
  adaptiveHedge?: AdaptiveHedge;
  /** Portfolios indexed by regime (0 = Crisis ... 4 = Strong Risk-On). */
  regimePortfolios: [Weights, Weights, Weights, Weights, Weights];
  continuous: {
    scoreLow: number;
    scoreHigh: number;
    minEquity: number;
    maxEquity: number;
    equityAsset: AssetKey; // unlevered equity sleeve
    leveragedAsset: AssetKey; // used for exposure > 1
    defensive: Weights; // mix for the non-equity part (normalised)
  };
}

export function normalise(w: Weights): Weights {
  const tot = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
  if (tot <= 0) return { BIL: 1 };
  const out: Weights = {};
  for (const [k, v] of Object.entries(w)) if (v && v > 0) out[k as AssetKey] = v / tot;
  return out;
}

export function continuousWeights(score: number, c: AllocationParams['continuous']): Weights {
  const span = c.scoreHigh - c.scoreLow;
  const x = span > 0 ? Math.min(1, Math.max(0, (score - c.scoreLow) / span)) : score >= c.scoreHigh ? 1 : 0;
  const e = c.minEquity + x * (c.maxEquity - c.minEquity);
  const out: Weights = {};
  const add = (k: AssetKey, v: number) => {
    if (v > 1e-12) out[k] = (out[k] ?? 0) + v;
  };
  const L = LEVERAGE[c.leveragedAsset] ?? 2;
  if (e <= 1) {
    add(c.equityAsset, e);
    const def = normalise(c.defensive);
    for (const [k, v] of Object.entries(def)) add(k as AssetKey, (1 - e) * (v ?? 0));
  } else {
    // exposure e from a fully invested blend of 1x and Lx: a + b = 1, a + L b = e
    const b = Math.min(1, (e - 1) / (L - 1));
    add(c.leveragedAsset, b);
    add(c.equityAsset, 1 - b);
  }
  return out;
}

/** Equity exposure of a weight vector: unlevered equity sleeves count once, leveraged ETFs L times. */
export function equityExposure(w: Weights): number {
  let e = 0;
  for (const [k, v] of Object.entries(w)) {
    const key = k as AssetKey;
    if (EQUITY_ASSETS.has(key)) e += v ?? 0;
    else if (LEVERAGE[key]) e += (v ?? 0) * LEVERAGE[key]!;
  }
  return e;
}
