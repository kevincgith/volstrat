/**
 * Daily return series for tradeable assets.
 *
 * ETF segments are used as published (already net of fees). Gross index or
 * proxy segments (total-return indices, T-bill accrual, gold futures) have the
 * ETF's expense ratio deducted daily. Leveraged ETFs are extended before
 * inception with a synthetic daily-rebalanced series:
 *   r = L * r_index - (L - 1) * (cash + spread) - expense / 252
 */

import type { MarketData } from './data';
import { returnsFromIndex } from './stats';

export const STRATEGY_ASSETS = ['SPX', 'SSO', 'UPRO', 'WORLD', 'IEF', 'TLT', 'AGG', 'SHY', 'BIL', 'GLD', 'XLU'] as const;
export type AssetKey = (typeof STRATEGY_ASSETS)[number];

/** Segments whose returns are gross of any fund fee. */
const GROSS_SOURCES = new Set(['^SP500TR', '^990100-USD-STRD', 'cash', 'GC=F']);

export const LEVERAGE: Partial<Record<AssetKey, number>> = { SSO: 2, UPRO: 3 };

export interface AssetParams {
  /** Annual spread over T-bills paid on the borrowed (L-1) exposure. */
  financingSpread: number;
  /** Use the synthetic series for the whole history (not only pre-inception). */
  alwaysSynthetic: boolean;
}

export interface AssetSeries {
  key: string;
  label: string;
  returns: Float64Array;
  /** 1 where the return comes from a proxy/synthetic segment. */
  synthetic: Uint8Array;
  first: number; // first index with a finite return
}

function dateIndex(dates: string[], iso: string): number {
  // dates are sorted ISO strings: binary search for the first date >= iso
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (dates[mid]! < iso) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function firstFinite(x: Float64Array): number {
  for (let i = 0; i < x.length; i++) if (Number.isFinite(x[i]!)) return i;
  return x.length;
}

export function plainAsset(d: MarketData, key: string): AssetSeries {
  const a = d.assets[key];
  const n = d.dates.length;
  if (!a) return { key, label: key, returns: new Float64Array(n).fill(NaN), synthetic: new Uint8Array(n), first: n };
  const r = returnsFromIndex(a.tr);
  const syn = new Uint8Array(n);
  const fee = a.expense_ratio / 252;
  for (const seg of a.segments) {
    const i0 = dateIndex(d.dates, seg.from);
    const i1 = dateIndex(d.dates, seg.to);
    for (let i = i0; i <= i1 && i < n; i++) {
      if (seg.synthetic) syn[i] = 1;
      if (GROSS_SOURCES.has(seg.source) && Number.isFinite(r[i]!)) r[i] = r[i]! - fee;
    }
  }
  return { key, label: a.label, returns: r, synthetic: syn, first: firstFinite(r) };
}

/** Synthetic L-times daily-levered S&P 500 from the S&P total return and T-bills. */
export function syntheticLeveraged(
  d: MarketData,
  lev: number,
  expense: number,
  spread: number,
): Float64Array {
  const spx = d.assets.SPX!;
  const cash = returnsFromIndex(d.assets.CASH!.tr);
  const idx = returnsFromIndex(spx.tr);
  const n = d.dates.length;
  // add back the SPY fee where SPY (net) is the source, to get the gross index return
  const spyFee = new Float64Array(n);
  for (const seg of spx.segments) {
    if (GROSS_SOURCES.has(seg.source)) continue;
    const i0 = dateIndex(d.dates, seg.from);
    const i1 = dateIndex(d.dates, seg.to);
    for (let i = i0; i <= i1 && i < n; i++) spyFee[i] = spx.expense_ratio / 252;
  }
  const out = new Float64Array(n).fill(NaN);
  for (let t = 1; t < n; t++) {
    const ri = idx[t]!;
    const c = cash[t]!;
    if (!Number.isFinite(ri) || !Number.isFinite(c)) continue;
    const days = (Date.parse(d.dates[t]!) - Date.parse(d.dates[t - 1]!)) / 86_400_000;
    out[t] = lev * (ri + spyFee[t]!) - (lev - 1) * (c + (spread * days) / 360) - expense / 252;
  }
  return out;
}

export function buildAssets(d: MarketData, p: AssetParams): Record<string, AssetSeries> {
  const out: Record<string, AssetSeries> = {};
  for (const key of [...STRATEGY_ASSETS, 'CASH']) {
    const base = plainAsset(d, key);
    const lev = LEVERAGE[key as AssetKey];
    if (lev && d.assets.SPX && d.assets.CASH) {
      const syn = syntheticLeveraged(d, lev, d.assets[key]?.expense_ratio ?? 0.009, p.financingSpread);
      const r = Float64Array.from(base.returns);
      const flag = new Uint8Array(base.synthetic);
      for (let t = 0; t < r.length; t++) {
        if (p.alwaysSynthetic || t < base.first) {
          r[t] = syn[t]!;
          flag[t] = Number.isFinite(syn[t]!) ? 1 : 0;
        }
      }
      out[key] = { ...base, returns: r, synthetic: flag, first: firstFinite(r) };
    } else {
      out[key] = base;
    }
  }
  return out;
}
