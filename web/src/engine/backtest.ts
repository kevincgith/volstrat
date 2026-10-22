/**
 * Daily portfolio simulator.
 *
 * Timing (no look-ahead): a target decided from information available at the
 * close of day d is traded at the close of day d + lag (lag >= 1). That day's
 * return is earned on the old holdings and the new weights start earning on
 * day d + lag + 1. Holdings drift with returns between trades.
 *
 * Costs: `costBps` per unit of notional traded (each side), so a full switch
 * from asset A to asset B (|Δw| summed = 2) costs 2 x costBps.
 */

import type { AssetSeries } from './assets';
import type { Weights } from './allocation';

export type RebalanceRule = 'daily' | 'weekly' | 'monthly' | 'regime';

export interface BacktestParams {
  lag: number;
  rebalance: RebalanceRule;
  /** Daily/weekly/monthly: skip trades when no weight is off target by more than this. */
  band: number;
  costBps: number;
}

export interface BacktestResult {
  start: number;
  end: number;
  nav: Float64Array; // NaN outside [start, end]
  returns: Float64Array; // daily portfolio returns (NaN outside (start, end])
  weights: Record<string, Float64Array>; // end-of-day weights after trading
  turnover: Float64Array; // one-way turnover traded each day
  costs: Float64Array; // cost as a fraction of NAV each day
  trades: number;
  /** Days a held asset had no return (treated as 0). Should be 0 for a valid run. */
  missingReturnDays: number;
}

/** True if `d` is the last trading day of its week / month in the calendar. */
export function isPeriodEnd(dates: string[], d: number, period: 'week' | 'month'): boolean {
  if (d >= dates.length - 1) return true;
  const a = new Date(dates[d]! + 'T00:00:00Z');
  const b = new Date(dates[d + 1]! + 'T00:00:00Z');
  if (period === 'month') return a.getUTCMonth() !== b.getUTCMonth();
  const gap = (b.getTime() - a.getTime()) / 86_400_000;
  return gap >= 7 || b.getUTCDay() <= a.getUTCDay();
}

function sameWeights(a: Weights | null, b: Weights | null, eps = 1e-9): boolean {
  if (!a || !b) return a === b;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (Math.abs((a[k as keyof Weights] ?? 0) - (b[k as keyof Weights] ?? 0)) > eps) return false;
  }
  return true;
}

export function simulate(
  dates: string[],
  assets: Record<string, AssetSeries>,
  targets: (Weights | null)[],
  p: BacktestParams,
  startIdx: number,
  endIdx: number,
): BacktestResult {
  const n = dates.length;
  const lag = Math.max(1, Math.floor(p.lag));
  const keys = Object.keys(assets);
  const K = keys.length;
  const idx = new Map(keys.map((k, i) => [k, i]));
  const R = keys.map((k) => assets[k]!.returns);
  const nav = new Float64Array(n).fill(NaN);
  const rets = new Float64Array(n).fill(NaN);
  const turnover = new Float64Array(n).fill(0);
  const costs = new Float64Array(n).fill(0);
  const wOut: Record<string, Float64Array> = {};
  for (const k of keys) wOut[k] = new Float64Array(n).fill(NaN);

  // dense vectors for each distinct target object
  const dense = new Map<Weights, Float64Array>();
  const vec = (w: Weights): Float64Array => {
    let v = dense.get(w);
    if (!v) {
      v = new Float64Array(K);
      for (const [k, x] of Object.entries(w)) {
        const i = idx.get(k);
        if (i === undefined) throw new Error(`unknown asset ${k}`);
        v[i] = x ?? 0;
      }
      dense.set(w, v);
    }
    return v;
  };

  // first day with a target available `lag` days earlier
  let s = Math.max(startIdx, lag);
  while (s <= endIdx && !targets[s - lag]) s++;
  const e = Math.min(endIdx, n - 1);
  const res: BacktestResult = {
    start: s,
    end: e,
    nav,
    returns: rets,
    weights: wOut,
    turnover,
    costs,
    trades: 0,
    missingReturnDays: 0,
  };
  if (s > e) return res;

  const w = new Float64Array(K);
  let lastTarget: Weights | null = targets[s - lag]!;
  w.set(vec(lastTarget));
  let value = 1;
  nav[s] = 1;
  const record = (t: number) => {
    for (let i = 0; i < K; i++) if (w[i]! !== 0) wOut[keys[i]!]![t] = w[i]!;
  };
  record(s);

  for (let t = s + 1; t <= e; t++) {
    // 1) earn day t's return on the holdings carried from t-1
    let port = 0;
    let missing = false;
    for (let i = 0; i < K; i++) {
      if (w[i]! === 0) continue;
      let r = R[i]![t]!;
      if (!Number.isFinite(r)) {
        r = 0;
        missing = true;
      }
      port += w[i]! * r;
    }
    if (missing) res.missingReturnDays++;
    value *= 1 + port;
    rets[t] = port;
    if (1 + port > 0) {
      for (let i = 0; i < K; i++) {
        if (w[i]! === 0) continue;
        const r = R[i]![t]!;
        w[i] = (w[i]! * (1 + (Number.isFinite(r) ? r : 0))) / (1 + port);
      }
    }

    // 2) trade at the close of t on the target decided at t - lag
    const d = t - lag;
    const target = targets[d] ?? null;
    let trade = false;
    if (target) {
      switch (p.rebalance) {
        case 'daily':
          trade = true;
          break;
        case 'weekly':
          trade = isPeriodEnd(dates, d, 'week');
          break;
        case 'monthly':
          trade = isPeriodEnd(dates, d, 'month');
          break;
        case 'regime':
          trade = target !== lastTarget && !sameWeights(target, lastTarget);
          break;
      }
    }
    if (trade && target) {
      const tv = vec(target);
      let traded = 0;
      let maxDev = 0;
      for (let i = 0; i < K; i++) {
        const dev = Math.abs(tv[i]! - w[i]!);
        traded += dev;
        if (dev > maxDev) maxDev = dev;
      }
      const banded = p.rebalance !== 'regime' && maxDev <= p.band;
      if (traded > 1e-12 && !banded) {
        const c = (traded * p.costBps) / 10_000;
        value *= 1 - c;
        costs[t] = c;
        turnover[t] = traded / 2;
        res.trades++;
        w.set(tv);
        lastTarget = target;
        rets[t] = (1 + port) * (1 - c) - 1;
      } else if (p.rebalance === 'regime') {
        lastTarget = target;
      }
    }
    nav[t] = value;
    record(t);
  }
  return res;
}
