/**
 * VolStrat v3 (docs/PREREG-v3.md): an equity tilt of 40-80% around 60/40,
 * driven by three equally weighted pillars, each in [-1, +1] (+1 = more equity):
 *
 *   P1 volatility stress: implied vol level, vol curve (1m/3m) and variance
 *      risk premium, each ranked against its whole history to date
 *   P2 trend: index vs its 200-day average, saturating at +/-10%
 *   P3 volatility scaling: log2(median realised vol to date / 21-day realised vol)
 *
 * Market-agnostic: the same code runs on US and European inputs. Every value
 * at t uses inputs up to t only; targets decided at t trade at t + lag.
 */

import { plainAsset, type AssetSeries } from './assets';
import type { MarketData } from './data';
import { simulate, type BacktestResult } from './backtest';
import { computeMetrics, type Metrics } from './metrics';
import { realisedVol, rollingPercentile, sma } from './stats';

export interface V3Params {
  base: number;
  tilt: number;
  trendSat: number;
  maDays: number;
  rvDays: number;
  minPeriods: number;
  /** Weights of P1, P2, P3. */
  pillarWeights: [number, number, number];
  band: number;
  costBps: number;
  lag: number;
}

/** Frozen 2026-10-23 (PREREG-v3 section 3). */
export const V3_PARAMS: V3Params = {
  base: 0.6,
  tilt: 0.2,
  trendSat: 0.1,
  maDays: 200,
  rvDays: 21,
  minPeriods: 252,
  pillarWeights: [1, 1, 1],
  band: 0.05,
  costBps: 5,
  lag: 1,
};

export interface V3Market {
  dates: string[];
  /** Equity price index (trend and realised vol). */
  index: Float64Array;
  /** 30-day implied volatility (VIX / VSTOXX), in vol points. */
  vol: Float64Array;
  /** Implied vol 1m / 3m (VIX/VIX3M, VSTOXX 1M/3M); NaN where unavailable. */
  curve: Float64Array;
  /** Total-return assets: the equity sleeve, the bond sleeve and cash. */
  equity: AssetSeries;
  bond: AssetSeries;
  cash: AssetSeries;
}

export interface V3Signal {
  p1: Float64Array;
  p2: Float64Array;
  p3: Float64Array;
  s: Float64Array;
  equityWeight: Float64Array;
}

const clamp = (x: number) => Math.max(-1, Math.min(1, x));

/** Median of x[0..t] over finite values, NaN until `minPeriods` exist. Causal. */
export function expandingMedian(x: Float64Array, minPeriods: number): Float64Array {
  const out = new Float64Array(x.length).fill(NaN);
  const sorted: number[] = [];
  for (let t = 0; t < x.length; t++) {
    const v = x[t]!;
    if (Number.isFinite(v)) {
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (sorted[mid]! < v) lo = mid + 1;
        else hi = mid;
      }
      sorted.splice(lo, 0, v);
    }
    const n = sorted.length;
    if (n >= minPeriods && n > 0) out[t] = n % 2 ? sorted[(n - 1) >> 1]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  }
  return out;
}

export function v3Signal(m: V3Market, p: V3Params = V3_PARAMS): V3Signal {
  const n = m.dates.length;
  const rv = realisedVol(m.index, p.rvDays);
  const vrp = m.vol.map((v, t) => v - rv[t]!);
  // oriented so that 100 = calm
  const level = rollingPercentile(m.vol, 0, p.minPeriods).map((x) => 100 - x);
  const curve = rollingPercentile(m.curve, 0, p.minPeriods).map((x) => 100 - x);
  const prem = rollingPercentile(vrp, 0, p.minPeriods);
  const ma = sma(m.index, p.maDays);
  const med = expandingMedian(rv, p.minPeriods);
  const p1 = new Float64Array(n).fill(NaN);
  const p2 = new Float64Array(n).fill(NaN);
  const p3 = new Float64Array(n).fill(NaN);
  const s = new Float64Array(n).fill(NaN);
  const eq = new Float64Array(n).fill(NaN);
  const [w1, w2, w3] = p.pillarWeights;
  for (let t = 0; t < n; t++) {
    let acc = 0;
    let k = 0;
    for (const c of [level[t]!, curve[t]!, prem[t]!]) {
      if (Number.isFinite(c)) {
        acc += c;
        k++;
      }
    }
    if (k) p1[t] = (acc / k - 50) / 50;
    if (Number.isFinite(ma[t]!) && ma[t]! > 0 && Number.isFinite(m.index[t]!)) p2[t] = clamp((m.index[t]! / ma[t]! - 1) / p.trendSat);
    if (Number.isFinite(med[t]!) && rv[t]! > 0) p3[t] = clamp(Math.log2(med[t]! / rv[t]!));
    if (Number.isFinite(p1[t]!) && Number.isFinite(p2[t]!) && Number.isFinite(p3[t]!)) {
      s[t] = (w1 * p1[t]! + w2 * p2[t]! + w3 * p3[t]!) / (w1 + w2 + w3);
      eq[t] = p.base + p.tilt * s[t]!;
    }
  }
  return { p1, p2, p3, s, equityWeight: eq };
}

export interface V3Run {
  signal: V3Signal;
  strategy: BacktestResult;
  benchmark: BacktestResult;
  start: number;
  end: number;
}

type W = Record<string, number>;

/** Strategy (weekly, banded) and 60/40 benchmark (monthly) over [first signal + lag, end]. */
export function v3Run(m: V3Market, p: V3Params = V3_PARAMS, start = '', end = ''): V3Run {
  const n = m.dates.length;
  const signal = v3Signal(m, p);
  const assets = { EQ: m.equity, BOND: m.bond, CASH: m.cash };
  const targets: (W | null)[] = Array.from(signal.equityWeight, (w) => (Number.isFinite(w) ? { EQ: w, BOND: 1 - w } : null));
  const bench: W = { EQ: p.base, BOND: 1 - p.base };
  let s = Math.max(m.equity.first, m.bond.first, m.cash.first);
  const firstSig = targets.findIndex((x) => x !== null);
  s = Math.max(s, (firstSig < 0 ? n : firstSig) + p.lag);
  if (start) s = Math.max(s, m.dates.findIndex((d) => d >= start));
  let e = n - 1;
  if (end) {
    while (e > 0 && m.dates[e]! > end) e--;
  }
  const sim = (tg: (W | null)[], rule: 'weekly' | 'monthly', band: number) =>
    simulate(m.dates, assets, tg as never, { lag: p.lag, rebalance: rule, band, costBps: p.costBps }, s, e);
  return {
    signal,
    strategy: sim(targets, 'weekly', p.band),
    benchmark: sim(new Array(n).fill(bench), 'monthly', 0),
    start: s,
    end: e,
  };
}

export function v3Metrics(m: V3Market, r: V3Run, a: number, b: number): { strategy: Metrics; benchmark: Metrics } {
  const cash = m.cash.returns;
  return {
    strategy: computeMetrics(m.dates, r.strategy.nav, a, b, cash, r.benchmark.nav, r.strategy.turnover, r.strategy.costs),
    benchmark: computeMetrics(m.dates, r.benchmark.nav, a, b, cash, r.benchmark.nav, r.benchmark.turnover, r.benchmark.costs),
  };
}

/** US inputs: S&P 500 price, VIX, VIX/VIX3M; S&P 500 total return, IEF (VFITX before 2002), T-bills. */
export function usV3Market(d: MarketData): V3Market {
  const vix = d.series.VIX!;
  const v3m = d.series.VIX3M!;
  return {
    dates: d.dates,
    index: d.series.SPX!,
    vol: vix,
    curve: vix.map((v, t) => (v3m[t]! > 0 ? v / v3m[t]! : NaN)),
    equity: plainAsset(d, 'SPX'),
    bond: plainAsset(d, 'IEF'),
    cash: plainAsset(d, 'CASH'),
  };
}
