/**
 * End-to-end run: data + params -> score, regimes, targets, strategy backtest,
 * benchmark backtests and statistics. Pure and deterministic, so it can run
 * in a Web Worker or in tests.
 */

import { normalise, continuousWeights, type Weights } from './allocation';
import { buildAssets, type AssetSeries } from './assets';
import { simulate, type BacktestResult } from './backtest';
import type { MarketData } from './data';
import { computeMetrics, type Metrics } from './metrics';
import type { Params } from './params';
import { computeScore, regimes as regimePath, REGIMES, type ScoreResult } from './score';
import { realisedVol } from './stats';

export interface PortfolioRun {
  id: string;
  label: string;
  result: BacktestResult;
  metrics: Metrics;
  /** Metrics on the in-sample / out-of-sample split, if one is set. */
  inSample?: Metrics;
  outOfSample?: Metrics;
}

export interface RunResult {
  score: ScoreResult;
  regimes: Int8Array;
  targets: (Weights | null)[];
  assets: Record<string, AssetSeries>;
  strategy: PortfolioRun;
  benchmarks: PortfolioRun[];
  start: number;
  end: number;
  oos: number; // index of out-of-sample start, or -1
  regimeShare: number[]; // share of days in each regime over [start, end]
  avgRegimeDays: number;
  notes: string[];
}

export function indexOfDate(dates: string[], iso: string, fallback: number): number {
  if (!iso) return fallback;
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (dates[mid]! < iso) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, dates.length - 1);
}

export function strategyTargets(score: Float64Array, reg: Int8Array, p: Params): (Weights | null)[] {
  const ports = p.allocation.regimePortfolios.map((w) => normalise(w));
  const out: (Weights | null)[] = new Array(score.length).fill(null);
  for (let t = 0; t < score.length; t++) {
    if (!Number.isFinite(score[t]!) || reg[t]! < 0) continue;
    out[t] = p.allocation.mode === 'regime' ? ports[reg[t]!]! : continuousWeights(score[t]!, p.allocation.continuous);
  }
  return out;
}

function usedAssets(targets: (Weights | null)[]): Set<string> {
  const s = new Set<string>();
  const seen = new Set<Weights>();
  for (const w of targets) {
    if (!w || seen.has(w)) continue;
    seen.add(w);
    for (const [k, v] of Object.entries(w)) if (v) s.add(k);
  }
  return s;
}

function benchmarkTargets(d: MarketData, assets: Record<string, AssetSeries>, p: Params) {
  const n = d.dates.length;
  const { equity, bond, volTarget, volLookback } = p.benchmarks;
  const fixed = (w: Weights) => new Array<Weights | null>(n).fill(w);
  // Vol-target benchmark: equity weight = min(1, target / trailing realised vol), rest in T-bills.
  const eqIdx = new Float64Array(n).fill(NaN);
  let lvl = 1;
  const er = assets[equity]!.returns;
  for (let t = 0; t < n; t++) {
    if (Number.isFinite(er[t]!)) {
      lvl *= 1 + er[t]!;
      eqIdx[t] = lvl;
    }
  }
  const rv = realisedVol(eqIdx, volLookback);
  const vt: (Weights | null)[] = new Array(n).fill(null);
  for (let t = 0; t < n; t++) {
    if (!Number.isFinite(rv[t]!) || rv[t]! <= 0) continue;
    const w = Math.min(1, (volTarget * 100) / rv[t]!);
    vt[t] = w >= 1 ? { [equity]: 1 } : { [equity]: w, BIL: 1 - w };
  }
  const eqLabel = equity === 'SPX' ? 'S&P 500' : 'MSCI World';
  return [
    { id: 'spx', label: 'S&P 500', targets: fixed({ SPX: 1 }), rule: 'monthly' as const },
    { id: 'world', label: 'MSCI World', targets: fixed({ WORLD: 1 }), rule: 'monthly' as const },
    { id: '80/20', label: `80/20 ${eqLabel}/${bond}`, targets: fixed({ [equity]: 0.8, [bond]: 0.2 }), rule: 'monthly' as const },
    { id: '60/40', label: `60/40 ${eqLabel}/${bond}`, targets: fixed({ [equity]: 0.6, [bond]: 0.4 }), rule: 'monthly' as const },
    { id: '40/60', label: `40/60 ${eqLabel}/${bond}`, targets: fixed({ [equity]: 0.4, [bond]: 0.6 }), rule: 'monthly' as const },
    { id: 'voltarget', label: `Vol target ${Math.round(volTarget * 100)}% (${eqLabel}/T-bills)`, targets: vt, rule: 'weekly' as const },
  ];
}

/** Small per-dataset memo for results that do not depend on the score parameters. */
const memo = new WeakMap<MarketData, Map<string, unknown>>();
function cached<T>(d: MarketData, key: string, f: () => T): T {
  let m = memo.get(d);
  if (!m) memo.set(d, (m = new Map()));
  if (!m.has(key)) {
    if (m.size > 50) m.clear();
    m.set(key, f());
  }
  return m.get(key) as T;
}

export function run(d: MarketData, p: Params): RunResult {
  const n = d.dates.length;
  const notes: string[] = [];
  const score = computeScore(d, p.score);
  const reg = regimePath(score.score, p.regime);
  const targets = strategyTargets(score.score, reg, p);
  const assets = cached(d, 'assets' + JSON.stringify(p.assets), () => buildAssets(d, p.assets));
  const benches = cached(d, 'benchT' + JSON.stringify([p.assets, p.benchmarks]), () => benchmarkTargets(d, assets, p));

  // Common start: user start, first usable signal (+lag), and every asset used having returns.
  const lag = Math.max(1, Math.floor(p.backtest.lag));
  let start = indexOfDate(d.dates, p.period.start, 0);
  const end = p.period.end ? Math.max(0, indexOfDate(d.dates, p.period.end, n - 1)) : n - 1;
  let firstSignal = targets.findIndex((w) => w !== null);
  if (firstSignal < 0) firstSignal = n;
  if (firstSignal + lag > start) {
    notes.push(`Start moved to ${d.dates[Math.min(firstSignal + lag, n - 1)]}: first date with enough signal history.`);
    start = firstSignal + lag;
  }
  const needed = new Set([...usedAssets(targets), ...benches.flatMap((b) => [...usedAssets(b.targets)]), 'CASH']);
  for (const k of needed) {
    const first = assets[k]?.first ?? n;
    if (first > start) {
      notes.push(`Start moved to ${d.dates[Math.min(first, n - 1)]}: ${assets[k]?.label ?? k} history begins then.`);
      start = first;
    }
  }
  const vtFirst = benches.find((b) => b.id === 'voltarget')!.targets.findIndex((w) => w !== null) + lag;
  if (vtFirst > start) start = vtFirst;
  start = Math.min(start, end);

  const oos = p.period.oosStart ? indexOfDate(d.dates, p.period.oosStart, -1) : -1;
  const cash = assets.CASH!.returns;

  const mk = (id: string, label: string, res: BacktestResult, refNav: Float64Array): PortfolioRun => {
    const m = computeMetrics(d.dates, res.nav, res.start, res.end, cash, refNav, res.turnover);
    const out: PortfolioRun = { id, label, result: res, metrics: m };
    if (oos > res.start + 21 && oos < res.end - 21) {
      out.inSample = computeMetrics(d.dates, res.nav, res.start, oos, cash, refNav, res.turnover);
      out.outOfSample = computeMetrics(d.dates, res.nav, oos, res.end, cash, refNav, res.turnover);
    }
    return out;
  };

  const benchKey = 'benchR' + JSON.stringify([p.assets, p.benchmarks, p.backtest.lag, p.backtest.costBps, start, end]);
  const benchResults = cached(d, benchKey, () =>
    benches.map((b) => ({
      b,
      res: simulate(d.dates, assets, b.targets, { ...p.backtest, rebalance: b.rule, band: 0 }, start, end),
    })),
  );
  const spxNav = benchResults[0]!.res.nav;
  const strategyRes = simulate(d.dates, assets, targets, p.backtest, start, end);
  if (strategyRes.missingReturnDays > 0) {
    notes.push(`${strategyRes.missingReturnDays} days had a held asset without a return (treated as 0).`);
  }

  const share = new Array(REGIMES.length).fill(0);
  let spells = 0;
  let prev = -2;
  let counted = 0;
  for (let t = strategyRes.start; t <= strategyRes.end; t++) {
    const r = reg[t]!;
    if (r < 0) continue;
    share[r]++;
    counted++;
    if (r !== prev) spells++;
    prev = r;
  }

  return {
    score,
    regimes: reg,
    targets,
    assets,
    strategy: mk('strategy', 'VolStrat', strategyRes, spxNav),
    benchmarks: benchResults.map(({ b, res }) => mk(b.id, b.label, res, spxNav)),
    start: strategyRes.start,
    end: strategyRes.end,
    oos,
    regimeShare: share.map((x) => (counted ? x / counted : 0)),
    avgRegimeDays: spells ? counted / spells : NaN,
    notes,
  };
}
