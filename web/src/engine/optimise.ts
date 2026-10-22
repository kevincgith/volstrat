/**
 * Objectives per regime: 'utility' (default) maximises excess return minus
 * gamma/2 x variance; 'maxSharpe' tends to pick short-duration bonds in every
 * regime (they have the highest Sharpe ratio), which is rarely what a tactical
 * allocator wants; 'minVariance'; 'maxReturnVolCap'.
 *
 * Optimisers for (1) what to hold in each regime and (2) signal component
 * weights. Both are deliberately paired with out-of-sample evaluation:
 * optimising on one history always finds *something*, so the in-sample result
 * is never shown without the out-of-sample one.
 *
 * Regime allocation: for each regime, estimate the mean vector and covariance
 * of asset returns on the days AFTER the regime was signalled (label at t ->
 * return at t + lag + 1, the same alignment as the diagnostics), then solve a
 * long-only portfolio with position caps. Means are shrunk toward their
 * cross-sectional average and the covariance toward its diagonal.
 */

import type { Weights } from './allocation';
import type { AssetKey, AssetSeries } from './assets';
import { simulate, type BacktestResult } from './backtest';
import type { MarketData } from './data';
import { computeMetrics, type Metrics } from './metrics';
import { merge, type Params } from './params';
import { indexOfDate, run } from './run';
import { REGIMES } from './score';

const DAYS = 252;

// ------------------------------------------------------------------ linear algebra
type Vec = number[];
type Mat = number[][];

const dot = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + x * b[i]!, 0);
const matVec = (m: Mat, v: Vec) => m.map((row) => dot(row, v));

/** Euclidean projection onto {0 <= w_i <= cap, sum w = 1} (bisection on the shift). */
export function projectCappedSimplex(v: Vec, cap: number): Vec {
  const k = v.length;
  const c = Math.max(cap, 1 / k);
  let lo = Math.min(...v) - c;
  let hi = Math.max(...v);
  for (let it = 0; it < 80; it++) {
    const tau = (lo + hi) / 2;
    const s = v.reduce((a, x) => a + Math.min(c, Math.max(0, x - tau)), 0);
    if (s > 1) lo = tau;
    else hi = tau;
  }
  const tau = (lo + hi) / 2;
  return v.map((x) => Math.min(c, Math.max(0, x - tau)));
}

/** max_w  w'mu - (gamma/2) w'Sigma w  s.t. capped simplex, by projected gradient. */
function meanVariance(mu: Vec, sigma: Mat, gamma: number, cap: number): Vec {
  const k = mu.length;
  let w = projectCappedSimplex(new Array(k).fill(1 / k), cap);
  // step from the largest eigenvalue bound (Gershgorin)
  const lmax = Math.max(...sigma.map((row) => row.reduce((a, x) => a + Math.abs(x), 0)));
  const step = 1 / Math.max(1e-12, gamma * lmax);
  for (let it = 0; it < 400; it++) {
    const g = matVec(sigma, w).map((x, i) => mu[i]! - gamma * x);
    const next = projectCappedSimplex(
      w.map((x, i) => x + step * g[i]!),
      cap,
    );
    const diff = next.reduce((a, x, i) => a + Math.abs(x - w[i]!), 0);
    w = next;
    if (diff < 1e-10) break;
  }
  return w;
}

// ------------------------------------------------------------------ regime moments
export interface Moments {
  n: number; // observations
  mu: Vec; // annualised mean excess return
  sigma: Mat; // annualised covariance
}

/**
 * Moments of asset excess returns on days following each regime.
 * Only returns with index <= `lastReturn` are used.
 */
export function regimeMoments(
  regimes: ArrayLike<number>,
  assets: Record<string, AssetSeries>,
  keys: string[],
  lag: number,
  from: number,
  lastReturn: number,
  meanShrink: number,
  covShrink: number,
): Moments[] {
  const off = Math.max(1, lag) + 1;
  const cash = assets.CASH!.returns;
  const rows: number[][][] = REGIMES.map(() => []);
  for (let t = from; t + off <= lastReturn; t++) {
    const g = regimes[t]!;
    if (g < 0) continue;
    const i = t + off;
    const c = Number.isFinite(cash[i]!) ? cash[i]! : 0;
    const r = keys.map((k) => assets[k]!.returns[i]! - c);
    if (r.every(Number.isFinite)) rows[g]!.push(r);
  }
  return rows.map((obs) => {
    const n = obs.length;
    const k = keys.length;
    if (n < 2) return { n, mu: new Array(k).fill(NaN), sigma: [] };
    const mean = keys.map((_, j) => obs.reduce((a, r) => a + r[j]!, 0) / n);
    const cov: Mat = keys.map((_, a) =>
      keys.map((__, b) => obs.reduce((s, r) => s + (r[a]! - mean[a]!) * (r[b]! - mean[b]!), 0) / (n - 1)),
    );
    const grand = mean.reduce((a, x) => a + x, 0) / k;
    const mu = mean.map((m) => ((1 - meanShrink) * m + meanShrink * grand) * DAYS);
    const sigma = cov.map((row, a) => row.map((x, b) => (a === b ? x : (1 - covShrink) * x) * DAYS));
    return { n, mu, sigma };
  });
}

export type AllocObjective = 'utility' | 'maxSharpe' | 'minVariance' | 'maxReturnVolCap';

export interface AllocOptions {
  universe: AssetKey[];
  objective: AllocObjective;
  /** Maximum weight per asset (0-1). */
  maxWeight: number;
  /** Shrink each mean toward the cross-asset average (0 = none, 1 = ignore means). */
  meanShrink: number;
  /** Shrink correlations toward zero (0-1). */
  covShrink: number;
  /** Volatility cap for maxReturnVolCap (annualised, e.g. 0.12). */
  volCap: number;
  /** Risk aversion gamma for the mean-variance utility objective. */
  riskAversion?: number;
  /** Regimes with fewer observations keep the current portfolio. */
  minObs: number;
}

export interface RegimeSolution {
  regime: number;
  weights: Weights;
  n: number;
  expReturn: number; // annualised excess, in-sample estimate
  expVol: number;
  kept: boolean; // true if too few observations: current portfolio kept
}

export function solveRegime(m: Moments, opt: AllocOptions, current: Weights): Omit<RegimeSolution, 'regime'> {
  const k = opt.universe.length;
  if (m.n < opt.minObs || !m.mu.every(Number.isFinite)) {
    return { weights: current, n: m.n, expReturn: NaN, expVol: NaN, kept: true };
  }
  const stats = (w: Vec) => {
    const r = dot(w, m.mu);
    const v = Math.sqrt(Math.max(0, dot(w, matVec(m.sigma, w))));
    return { r, v };
  };
  let best: Vec = new Array(k).fill(1 / k);
  if (opt.objective === 'minVariance') {
    best = meanVariance(new Array(k).fill(0), m.sigma, 1, opt.maxWeight);
  } else if (opt.objective === 'utility') {
    // max E[excess return] - gamma/2 * variance: the standard tactical-allocation trade-off
    best = meanVariance(m.mu, m.sigma, Math.max(0.1, opt.riskAversion ?? 3), opt.maxWeight);
  } else {
    let bestScore = -Infinity;
    for (let e = -2; e <= 3; e += 0.25) {
      const w = meanVariance(m.mu, m.sigma, 10 ** e, opt.maxWeight);
      const { r, v } = stats(w);
      const score = opt.objective === 'maxSharpe' ? (v > 0 ? r / v : -Infinity) : v <= opt.volCap + 1e-9 ? r : -Infinity;
      if (score > bestScore) {
        bestScore = score;
        best = w;
      }
    }
    if (bestScore === -Infinity) best = meanVariance(new Array(k).fill(0), m.sigma, 1, opt.maxWeight);
  }
  const weights: Weights = {};
  best.forEach((x, i) => {
    const r = Math.round(x * 100) / 100; // whole percentages, readable portfolios
    if (r > 0) weights[opt.universe[i]!] = r;
  });
  const tot = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
  for (const key of Object.keys(weights)) weights[key as AssetKey] = (weights[key as AssetKey] ?? 0) / tot;
  const s = stats(opt.universe.map((u) => weights[u] ?? 0));
  return { weights, n: m.n, expReturn: s.r, expVol: s.v, kept: false };
}

export function solveAllRegimes(
  regimes: ArrayLike<number>,
  assets: Record<string, AssetSeries>,
  lag: number,
  from: number,
  lastReturn: number,
  opt: AllocOptions,
  current: Weights[],
): RegimeSolution[] {
  const moments = regimeMoments(regimes, assets, opt.universe, lag, from, lastReturn, opt.meanShrink, opt.covShrink);
  return moments.map((m, g) => ({ regime: g, ...solveRegime(m, opt, current[g]!) }));
}

export interface AllocationOptimisation {
  /** Portfolios fitted on the whole training sample (in-sample). */
  inSample: RegimeSolution[];
  trainFrom: string;
  trainTo: string;
  /** Out-of-sample comparison over the walk-forward window. */
  oos: {
    from: string;
    to: string;
    current: Metrics;
    walkForward: Metrics;
    inSampleFixed: Metrics; // in-sample portfolios applied over the same window (look-ahead!)
    navCurrent: number[];
    navWalkForward: number[];
    navInSample: number[];
    dates: string[];
    refits: { date: string; portfolios: Weights[] }[];
  } | null;
}

function portfolioTargets(reg: ArrayLike<number>, score: Float64Array, ports: (t: number) => Weights[] | null): (Weights | null)[] {
  const out: (Weights | null)[] = new Array(reg.length).fill(null);
  for (let t = 0; t < reg.length; t++) {
    const g = reg[t]!;
    if (g < 0 || !Number.isFinite(score[t]!)) continue;
    const p = ports(t);
    if (p) out[t] = p[g]!;
  }
  return out;
}

/**
 * Fit regime portfolios in-sample, and evaluate a walk-forward version that
 * re-fits every `refitYears` on data up to the refit date only (expanding
 * window, at least `minTrainYears` of history).
 */
export function optimiseAllocation(
  d: MarketData,
  p: Params,
  opt: AllocOptions,
  wf: { minTrainYears: number; refitYears: number },
): AllocationOptimisation {
  const base = run(d, p);
  const reg = base.regimes;
  const score = base.score.score;
  const assets = base.assets;
  const lag = Math.max(1, p.backtest.lag);
  const current = p.allocation.regimePortfolios.map((w) => ({ ...w }));
  const start = base.start;
  const end = base.end;
  // signal history usable for fitting starts at the first labelled day
  let first = 0;
  while (first < reg.length && reg[first]! < 0) first++;
  // every asset in the universe must have returns
  const firstAsset = Math.max(...opt.universe.map((k) => assets[k]!.first));
  const fitFrom = Math.max(first, firstAsset);

  const inSample = solveAllRegimes(reg, assets, lag, fitFrom, end, opt, current);

  // walk-forward
  const minTrain = Math.round(wf.minTrainYears * DAYS);
  const step = Math.max(21, Math.round(wf.refitYears * DAYS));
  const wfStart = Math.max(start, fitFrom + minTrain);
  let oos: AllocationOptimisation['oos'] = null;
  if (wfStart < end - 63) {
    const refitDays: number[] = [];
    for (let t = wfStart; t <= end; t += step) refitDays.push(t);
    const fitted = refitDays.map((t) => solveAllRegimes(reg, assets, lag, fitFrom, t - 1, opt, current).map((s) => s.weights));
    const portsAt = (t: number) => {
      let k = -1;
      for (let i = 0; i < refitDays.length; i++) if (refitDays[i]! <= t) k = i;
      return k >= 0 ? fitted[k]! : null;
    };
    const inSamplePorts = inSample.map((s) => s.weights);
    const sim = (targets: (Weights | null)[]) => simulate(d.dates, assets, targets, p.backtest, wfStart, end);
    const resCurrent = sim(base.targets);
    const resWF = sim(portfolioTargets(reg, score, portsAt));
    const resIS = sim(portfolioTargets(reg, score, () => inSamplePorts));
    const cash = assets.CASH!.returns;
    const ref = base.benchmarks[0]!.result.nav;
    const m = (r: BacktestResult) => computeMetrics(d.dates, r.nav, r.start, r.end, cash, ref, r.turnover, r.costs);
    const s0 = Math.max(resCurrent.start, resWF.start, resIS.start);
    const slice = (r: BacktestResult) => Array.from(r.nav.slice(s0, end + 1), (x) => x / r.nav[s0]!);
    oos = {
      from: d.dates[s0]!,
      to: d.dates[end]!,
      current: m(resCurrent),
      walkForward: m(resWF),
      inSampleFixed: m(resIS),
      navCurrent: slice(resCurrent),
      navWalkForward: slice(resWF),
      navInSample: slice(resIS),
      dates: d.dates.slice(s0, end + 1),
      refits: refitDays.map((t, i) => ({ date: d.dates[t]!, portfolios: fitted[i]! })),
    };
  }
  return { inSample, trainFrom: d.dates[fitFrom]!, trainTo: d.dates[end]!, oos };
}

// ------------------------------------------------------------------ signal weights
export type WeightObjective = 'sharpe' | 'sortino' | 'calmar' | 'cagr';

export interface WeightOptimisation {
  ids: string[];
  current: Record<string, number>;
  optimised: Record<string, number>;
  trainFrom: string;
  trainTo: string;
  testFrom: string;
  testTo: string;
  train: { current: Metrics; optimised: Metrics; equal: Metrics };
  test: { current: Metrics; optimised: Metrics; equal: Metrics } | null;
  evaluations: number;
  path: { step: number; objective: number }[];
}

/**
 * Coordinate descent over component weights on the training period only.
 * Each pass tries every candidate value for every component, keeping a change
 * when it improves the training objective; stops when a pass changes nothing.
 */
export function optimiseWeights(
  d: MarketData,
  p: Params,
  opts: { objective: WeightObjective; trainEnd: string; values: number[]; maxPasses: number },
  onProgress?: (done: number, total: number) => void,
): WeightOptimisation {
  const ids = Object.entries(p.score.components)
    .filter(([, s]) => s.enabled)
    .map(([id]) => id);
  const base = run(d, p);
  const trainFrom = d.dates[base.start]!;
  const trainEndIdx = Math.min(indexOfDate(d.dates, opts.trainEnd, base.end), base.end);
  const trainTo = d.dates[trainEndIdx]!;
  const withWeights = (w: Record<string, number>, period: Partial<Params['period']>) =>
    merge(p, {
      period: { oosStart: '', ...period },
      score: { components: Object.fromEntries(ids.map((id) => [id, { weight: w[id]!, enabled: w[id]! > 0 }])) },
    });
  const evalOn = (w: Record<string, number>, period: Partial<Params['period']>): Metrics => run(d, withWeights(w, period)).strategy.metrics;
  const objective = (m: Metrics) => {
    const v = m[opts.objective];
    return Number.isFinite(v) ? v : -Infinity;
  };
  const trainPeriod = { start: trainFrom, end: trainTo };
  const current = Object.fromEntries(ids.map((id) => [id, p.score.components[id]!.weight]));
  let best = { ...current };
  let bestVal = objective(evalOn(best, trainPeriod));
  let evaluations = 1;
  const path = [{ step: 0, objective: bestVal }];
  const total = opts.maxPasses * ids.length * opts.values.length;
  let done = 0;
  for (let pass = 0; pass < opts.maxPasses; pass++) {
    let changed = false;
    for (const id of ids) {
      for (const v of opts.values) {
        done++;
        if (v === best[id]) continue;
        const cand = { ...best, [id]: v };
        if (Object.values(cand).every((x) => x <= 0)) continue;
        const val = objective(evalOn(cand, trainPeriod));
        evaluations++;
        if (val > bestVal + 1e-6) {
          best = cand;
          bestVal = val;
          changed = true;
          path.push({ step: evaluations, objective: val });
        }
        if (done % 5 === 0) onProgress?.(done, total);
      }
    }
    if (!changed) break;
  }
  onProgress?.(total, total);
  const equal = Object.fromEntries(ids.map((id) => [id, 1]));
  const hasTest = trainEndIdx < base.end - 63;
  const testPeriod = { start: d.dates[Math.min(trainEndIdx + 1, base.end)]!, end: d.dates[base.end]! };
  return {
    ids,
    current,
    optimised: best,
    trainFrom,
    trainTo,
    testFrom: testPeriod.start,
    testTo: testPeriod.end,
    train: { current: evalOn(current, trainPeriod), optimised: evalOn(best, trainPeriod), equal: evalOn(equal, trainPeriod) },
    test: hasTest
      ? { current: evalOn(current, testPeriod), optimised: evalOn(best, testPeriod), equal: evalOn(equal, testPeriod) }
      : null,
    evaluations,
    path,
  };
}


export interface WeightWalkForward {
  periods: { from: string; to: string; weights: Record<string, number>; trainObjective: number }[];
  dates: string[];
  nav: { walkForward: number[]; current: number[]; equal: number[] };
  metrics: { walkForward: Metrics; current: Metrics; equal: Metrics };
  evaluations: number;
}

/**
 * Walk-forward signal-weight optimisation. At each re-fit date the weight
 * search runs on all data from the backtest start up to the day before
 * (expanding window); the winning weights are then used only until the next
 * re-fit. Each period's daily returns come from a run with that period's
 * weights; a switching cost is charged on the position change at each re-fit.
 */
export function walkForwardWeights(
  d: MarketData,
  p: Params,
  opts: { objective: WeightObjective; firstTest: string; refitYears: number; values: number[]; maxPasses: number },
  onProgress?: (done: number, total: number) => void,
): WeightWalkForward | null {
  const ids = Object.entries(p.score.components)
    .filter(([, s]) => s.enabled)
    .map(([id]) => id);
  const base = run(d, p);
  const first = Math.min(indexOfDate(d.dates, opts.firstTest, base.end), base.end);
  if (first >= base.end - 63 || first - base.start < 252) return null;
  const step = Math.max(63, Math.round(opts.refitYears * DAYS));
  const refits: number[] = [];
  for (let t = first; t < base.end; t += step) refits.push(t);
  const withWeights = (w: Record<string, number>, period: Partial<Params['period']>) =>
    merge(p, {
      period: { oosStart: '', ...period },
      score: { components: Object.fromEntries(ids.map((id) => [id, { weight: w[id]!, enabled: w[id]! > 0 }])) },
    });
  const objective = (m: Metrics) => {
    const v = m[opts.objective];
    return Number.isFinite(v) ? v : -Infinity;
  };
  let evaluations = 0;
  const current = Object.fromEntries(ids.map((id) => [id, p.score.components[id]!.weight]));
  const total = refits.length;
  const periods: WeightWalkForward['periods'] = [];
  const n = d.dates.length;
  const nav = new Float64Array(n).fill(NaN);
  const turnover = new Float64Array(n);
  const costs = new Float64Array(n);
  nav[first] = 1;
  let prevWeights: Record<string, Float64Array> | null = null;
  refits.forEach((rt, k) => {
    // search on [start, rt - 1] only
    const trainPeriod = { start: d.dates[base.start]!, end: d.dates[rt - 1]! };
    let best = { ...current };
    let bestVal = objective(run(d, withWeights(best, trainPeriod)).strategy.metrics);
    evaluations++;
    for (let pass = 0; pass < opts.maxPasses; pass++) {
      let changed = false;
      for (const id of ids) {
        for (const v of opts.values) {
          if (v === best[id]) continue;
          const cand = { ...best, [id]: v };
          if (Object.values(cand).every((x) => x <= 0)) continue;
          const val = objective(run(d, withWeights(cand, trainPeriod)).strategy.metrics);
          evaluations++;
          if (val > bestVal + 1e-6) {
            best = cand;
            bestVal = val;
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    const end = k + 1 < refits.length ? refits[k + 1]! - 1 : base.end;
    // full-history run with these weights; use its returns over [rt, end]
    const r = run(d, withWeights(best, { start: d.dates[base.start]!, end: '' })).strategy.result;
    let switchCost = 0;
    let switchTraded = 0;
    if (prevWeights) {
      for (const key of new Set([...Object.keys(prevWeights), ...Object.keys(r.weights)])) {
        switchTraded += Math.abs((r.weights[key]?.[rt - 1] || 0) - (prevWeights[key]?.[rt - 1] || 0));
      }
      switchCost = (switchTraded * p.backtest.costBps) / 10_000;
    }
    for (let t = rt === first ? first + 1 : rt; t <= end; t++) {
      let x = r.returns[t]!;
      if (!Number.isFinite(x)) x = 0;
      turnover[t] = r.turnover[t]!;
      costs[t] = r.costs[t]!;
      if (t === rt && rt !== first) {
        x = (1 + x) * (1 - switchCost) - 1;
        turnover[t] = turnover[t]! + switchTraded / 2;
        costs[t] = costs[t]! + switchCost;
      }
      nav[t] = nav[t - 1]! * (1 + x);
    }
    prevWeights = r.weights;
    periods.push({ from: d.dates[rt]!, to: d.dates[end]!, weights: best, trainObjective: bestVal });
    onProgress?.(k + 1, total);
  });
  const testPeriod = { start: d.dates[first]!, end: d.dates[base.end]! };
  const cur = run(d, withWeights(current, testPeriod));
  const eq = run(d, withWeights(Object.fromEntries(ids.map((id) => [id, 1])), testPeriod));
  const cash = base.assets.CASH!.returns;
  const ref = base.benchmarks[0]!.result.nav;
  const s0 = Math.max(first, cur.strategy.result.start, eq.strategy.result.start);
  const rebase = (x: Float64Array) => Array.from(x.slice(s0, base.end + 1), (v) => v / x[s0]!);
  return {
    periods,
    dates: d.dates.slice(s0, base.end + 1),
    nav: { walkForward: rebase(nav), current: rebase(cur.strategy.result.nav), equal: rebase(eq.strategy.result.nav) },
    metrics: {
      walkForward: computeMetrics(d.dates, nav, s0, base.end, cash, ref, turnover, costs),
      current: cur.strategy.metrics,
      equal: eq.strategy.metrics,
    },
    evaluations,
  };
}
