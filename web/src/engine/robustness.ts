/**
 * Robustness tools: parameter-sensitivity grids, walk-forward parameter
 * selection and a multiple-testing yardstick.
 *
 * Walk-forward: at the start of each test window, pick the grid cell with the
 * best objective over the preceding training window (data strictly before the
 * test window), then hold that cell's positions for the test window. Every
 * cell's daily returns are causal, so the stitched series is out-of-sample
 * with respect to the parameter choice. A switching cost is charged on the
 * weight change when the chosen cell changes.
 */

import type { MarketData } from './data';
import { computeMetrics, type Metrics } from './metrics';
import { merge, type Params } from './params';
import { indexOfDate, run } from './run';

export type AxisParam = 'smoothing' | 'hysteresis' | 'window' | 'thresholdShift' | 'thresholdSpread' | 'lag' | 'costBps' | 'minPeriods';

export interface Axis {
  param: AxisParam;
  values: number[];
}

export const AXES: Record<AxisParam, { label: string; values: number[]; fmt: (v: number) => string }> = {
  smoothing: { label: 'Smoothing (EMA days)', values: [1, 3, 5, 10, 15, 20, 30], fmt: (v) => `${v}d` },
  hysteresis: { label: 'Hysteresis (pts)', values: [0, 1, 2.5, 5, 7.5, 10], fmt: (v) => `${v}` },
  window: { label: 'Standardisation window', values: [252, 504, 756, 1260, 2520, 0], fmt: (v) => (v === 0 ? 'exp.' : `${(v / 252).toFixed(0)}y`) },
  thresholdShift: { label: 'Cut-off shift (pts)', values: [-10, -5, 0, 5, 10], fmt: (v) => (v > 0 ? `+${v}` : `${v}`) },
  thresholdSpread: { label: 'Cut-off spread (x)', values: [0.5, 0.75, 1, 1.25, 1.5], fmt: (v) => `${v}x` },
  lag: { label: 'Execution lag (days)', values: [1, 2, 3, 5], fmt: (v) => `t+${v}` },
  costBps: { label: 'Cost per side (bp)', values: [0, 5, 10, 20, 40], fmt: (v) => `${v}bp` },
  minPeriods: { label: 'Min history (days)', values: [126, 252, 504], fmt: (v) => `${v}` },
};

export function applyAxis(p: Params, param: AxisParam, v: number): Params {
  const q = merge(p, {});
  switch (param) {
    case 'smoothing':
      q.score.smoothing = v;
      break;
    case 'hysteresis':
      q.regime.hysteresis = v;
      break;
    case 'window':
      q.score.window = v;
      break;
    case 'minPeriods':
      q.score.minPeriods = v;
      break;
    case 'thresholdShift':
      q.regime.thresholds = q.regime.thresholds.map((t) => Math.min(100, Math.max(0, t + v))) as Params['regime']['thresholds'];
      break;
    case 'thresholdSpread':
      q.regime.thresholds = q.regime.thresholds.map((t) => Math.min(100, Math.max(0, 50 + (t - 50) * v))) as Params['regime']['thresholds'];
      break;
    case 'lag':
      q.backtest.lag = v;
      break;
    case 'costBps':
      q.backtest.costBps = v;
      break;
  }
  return q;
}

export type Objective = 'sharpe' | 'cagr' | 'calmar' | 'sortino';

export interface GridCell {
  x: number;
  y: number;
  metrics: Metrics;
}

export interface GridRun {
  cells: GridCell[];
  /** Per-cell daily returns and end-of-day weights, for walk-forward. */
  returns: Float64Array[];
  weights: Record<string, Float64Array>[];
  start: number;
  end: number;
  base: Metrics;
}

/**
 * Run every (x, y) combination over a common period. The period is fixed to
 * the base run's period so cells are comparable.
 */
export function runGrid(d: MarketData, base: Params, xa: Axis, ya: Axis, onProgress?: (done: number, total: number) => void): GridRun {
  const baseRun = run(d, base);
  const start = baseRun.start;
  const end = baseRun.end;
  const total = xa.values.length * ya.values.length;
  const cells: GridCell[] = [];
  const returns: Float64Array[] = [];
  const weights: Record<string, Float64Array>[] = [];
  let done = 0;
  for (const yv of ya.values) {
    for (const xv of xa.values) {
      let p = applyAxis(applyAxis(base, xa.param, xv), ya.param, yv);
      p = merge(p, { period: { start: d.dates[start], end: d.dates[end] } });
      const r = run(d, p);
      // a cell whose signal starts later than the common start is evaluated from its own start
      cells.push({ x: xv, y: yv, metrics: r.strategy.metrics });
      returns.push(r.strategy.result.returns);
      weights.push(r.strategy.result.weights);
      onProgress?.(++done, total);
    }
  }
  return { cells, returns, weights, start, end, base: baseRun.strategy.metrics };
}

function objectiveValue(m: Metrics, o: Objective): number {
  const v = m[o];
  return Number.isFinite(v) ? v : -Infinity;
}

export interface WalkForwardPeriod {
  testStart: string;
  testEnd: string;
  chosen: number; // cell index
  trainObjective: number;
}

export interface WalkForwardResult {
  nav: Float64Array;
  start: number; // first OOS day
  end: number;
  periods: WalkForwardPeriod[];
  metrics: Metrics;
  /** Base parameters over the same OOS window, for comparison. */
  baseMetrics: Metrics;
}

export function walkForward(
  d: MarketData,
  grid: GridRun,
  baseReturns: Float64Array,
  cash: Float64Array,
  refNav: Float64Array,
  opts: { trainYears: number; testYears: number; objective: Objective; costBps: number },
): WalkForwardResult | null {
  const { start, end } = grid;
  const trainDays = Math.round(opts.trainYears * 252);
  const testDays = Math.max(21, Math.round(opts.testYears * 252));
  const first = start + trainDays;
  if (first >= end - 21) return null;
  const n = d.dates.length;
  const nav = new Float64Array(n).fill(NaN);
  const baseNav = new Float64Array(n).fill(NaN);
  nav[first] = 1;
  baseNav[first] = 1;
  const periods: WalkForwardPeriod[] = [];
  let prev = -1;
  for (let ts = first; ts <= end; ts += testDays) {
    const te = Math.min(end, ts + testDays - 1);
    // choose using data strictly before ts: train window [ts - trainDays, ts - 1]
    const trS = Math.max(start, ts - trainDays);
    const trE = ts - 1;
    let best = 0;
    let bestV = -Infinity;
    grid.returns.forEach((r, i) => {
      const local = new Float64Array(n).fill(NaN);
      local[trS] = 1;
      for (let t = trS + 1; t <= trE; t++) local[t] = local[t - 1]! * (1 + (Number.isFinite(r[t]!) ? r[t]! : 0));
      const m = computeMetrics(d.dates, local, trS, trE, cash, refNav);
      const v = objectiveValue(m, opts.objective);
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    });
    // switching cost at the boundary: weight change between the old and new cell's holdings
    let switchCost = 0;
    if (prev >= 0 && prev !== best) {
      const a = grid.weights[prev]!;
      const b = grid.weights[best]!;
      let traded = 0;
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        traded += Math.abs((b[k]?.[ts - 1] || 0) - (a[k]?.[ts - 1] || 0));
      }
      switchCost = (traded * opts.costBps) / 10_000;
    }
    for (let t = ts === first ? first + 1 : ts; t <= te; t++) {
      let r = grid.returns[best]![t]!;
      if (!Number.isFinite(r)) r = 0;
      if (t === ts && ts !== first) r = (1 + r) * (1 - switchCost) - 1;
      nav[t] = nav[t - 1]! * (1 + r);
      const rb = Number.isFinite(baseReturns[t]!) ? baseReturns[t]! : 0;
      baseNav[t] = baseNav[t - 1]! * (1 + rb);
    }
    periods.push({ testStart: d.dates[ts]!, testEnd: d.dates[te]!, chosen: best, trainObjective: bestV });
    prev = best;
  }
  return {
    nav,
    start: first,
    end,
    periods,
    metrics: computeMetrics(d.dates, nav, first, end, cash, refNav),
    baseMetrics: computeMetrics(d.dates, baseNav, first, end, cash, refNav),
  };
}

/**
 * Expected maximum annualised Sharpe ratio among N independent zero-skill
 * strategies over `years` (approximation: SE of an annualised SR ~ 1/sqrt(years);
 * E[max of N std normals] ~ sqrt(2 ln N) - (ln ln N + ln 4pi) / (2 sqrt(2 ln N))).
 */
export function expectedMaxSharpe(N: number, years: number): number {
  if (N < 2 || years <= 0) return 0;
  const a = Math.sqrt(2 * Math.log(N));
  const z = a - (Math.log(Math.log(N)) + Math.log(4 * Math.PI)) / (2 * a);
  return z / Math.sqrt(years);
}

export { indexOfDate };
