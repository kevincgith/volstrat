/**
 * End-to-end run: data + params -> score, regimes, targets, strategy backtest,
 * benchmark backtests and statistics. Pure and deterministic, so it can run
 * in a Web Worker or in tests.
 */

import { continuousWeights, filterDefensive, normalise, swapDuration, type RiskBudgetParams, type Weights } from './allocation';
import { buildAssets, LEVERAGE, type AssetSeries } from './assets';
import { simulate, type BacktestResult } from './backtest';
import type { MarketData } from './data';
import { computeMetrics, type Metrics } from './metrics';
import type { Params } from './params';
import { applyReentry, applyRebound, computeScore, regimes as regimePath, REGIMES, type ScoreResult } from './score';
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

/** Which override set the day's regime: 0 none (the score's own regime), 1 panic rebound (§15.2), 2 recovery re-entry (§15.5). */
export const OVERRIDE_NONE = 0;
export const OVERRIDE_REBOUND = 1;
export const OVERRIDE_REENTRY = 2;

export interface RunResult {
  score: ScoreResult;
  regimes: Int8Array;
  /** Regime from the score alone (cut-offs and buffers), before any override. */
  scoreRegimes: Int8Array;
  /** Per day: which override, if any, changed the regime (OVERRIDE_*). */
  override: Int8Array;
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

/**
 * Trailing Pearson correlation of two daily return series over `n` days
 * ending at t (inclusive): uses information up to the close of t only.
 */
export function rollingCorrelation(a: Float64Array, b: Float64Array, n: number): Float64Array {
  const out = new Float64Array(a.length).fill(NaN);
  for (let t = n - 1; t < a.length; t++) {
    let sa = 0;
    let sb = 0;
    let saa = 0;
    let sbb = 0;
    let sab = 0;
    let k = 0;
    for (let i = t - n + 1; i <= t; i++) {
      const x = a[i]!;
      const y = b[i]!;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      sa += x;
      sb += y;
      saa += x * x;
      sbb += y * y;
      sab += x * y;
      k++;
    }
    if (k < Math.max(10, n * 0.8)) continue;
    const cov = sab - (sa * sb) / k;
    const va = saa - (sa * sa) / k;
    const vb = sbb - (sb * sb) / k;
    if (va > 0 && vb > 0) out[t] = cov / Math.sqrt(va * vb);
  }
  return out;
}

export function strategyTargets(
  score: Float64Array,
  reg: Int8Array,
  p: Params,
  stockBondCorr?: Float64Array,
): (Weights | null)[] {
  const ports = p.allocation.regimePortfolios.map((w) => normalise(w));
  const hedge = p.allocation.adaptiveHedge;
  const swapOn = !!(hedge?.enabled && stockBondCorr);
  const swapped = swapOn ? ports.map((w) => swapDuration(w, hedge!.replacement)) : ports;
  const out: (Weights | null)[] = new Array(score.length).fill(null);
  for (let t = 0; t < score.length; t++) {
    if (!Number.isFinite(score[t]!) || reg[t]! < 0) continue;
    const swap = swapOn && stockBondCorr![t]! > hedge!.threshold;
    if (p.allocation.mode === 'regime') {
      out[t] = (swap ? swapped : ports)[reg[t]!]!;
    } else {
      const w = continuousWeights(score[t]!, p.allocation.continuous);
      out[t] = swap ? swapDuration(w, hedge!.replacement) : w;
    }
  }
  return out;
}

/**
 * Risk-budget targets (docs/PREREG-v5.md §2). Uses equity and bond returns up to the
 * close of t only: realised volatility over `volWindow` days, the equity total-return
 * index against its `trendWindow`-day simple average, and the trailing stock-bond
 * correlation. Null until every input is available.
 */
export function riskBudgetTargets(assets: Record<string, AssetSeries>, rb: RiskBudgetParams, n: number, unemploymentGap?: Float64Array): (Weights | null)[] {
  const eq = assets[rb.equityAsset]!.returns;
  const idx = new Float64Array(n).fill(NaN);
  let lvl = 1;
  for (let t = 0; t < n; t++) {
    if (Number.isFinite(eq[t]!)) {
      lvl *= 1 + eq[t]!;
      idx[t] = lvl;
    }
  }
  const vw = Math.max(5, Math.round(rb.volWindow));
  const tw = Math.max(20, Math.round(rb.trendWindow));
  const corr = rb.hedgeLookback > 0 && assets[rb.bondAsset] ? rollingCorrelation(eq, assets[rb.bondAsset]!.returns, Math.max(20, Math.round(rb.hedgeLookback))) : null;
  const out: (Weights | null)[] = new Array(n).fill(null);
  let sum = 0;
  let cnt = 0;
  for (let t = 0; t < n; t++) {
    if (Number.isFinite(idx[t]!)) {
      sum += idx[t]!;
      cnt++;
    }
    if (t >= tw && Number.isFinite(idx[t - tw]!)) {
      sum -= idx[t - tw]!;
      cnt--;
    }
    if (t < Math.max(vw, tw) || cnt < tw || !Number.isFinite(idx[t]!)) continue;
    let m = 0;
    let ok = true;
    for (let i = t - vw + 1; i <= t; i++) {
      if (!Number.isFinite(eq[i]!)) ok = false;
      m += eq[i]!;
    }
    if (!ok) continue;
    m /= vw;
    let v = 0;
    for (let i = t - vw + 1; i <= t; i++) v += (eq[i]! - m) ** 2;
    const sd = Math.sqrt(v / (vw - 1)) * Math.sqrt(252);
    if (!(sd > 0)) continue;
    let w = Math.min(rb.maxEquity, rb.targetVol / sd);
    // with the recession gate on, the brake is skipped only when the gap is known and not positive
    const gated = rb.recessionGate?.enabled && unemploymentGap && Number.isFinite(unemploymentGap[t]!) && unemploymentGap[t]! <= 0;
    if (idx[t]! < sum / cnt && !gated) w *= rb.brake;
    const hedged = corr && Number.isFinite(corr[t]!) && corr[t]! < 0;
    const def = hedged ? rb.bondAsset : rb.cashAsset;
    if (w > 1 + 1e-12) {
      // exposure above 100%: a fully invested blend of the equity and its leveraged ETF,
      // a + L·b = w with a + b = 1, as in continuous mode (financing and fees are in the ETF)
      const lev = rb.leveragedAsset ?? 'SSO';
      const L = LEVERAGE[lev] ?? 2;
      const b = Math.min(1, (w - 1) / (L - 1));
      out[t] = b >= 1 - 1e-12 ? { [lev]: 1 } : { [rb.equityAsset]: 1 - b, [lev]: b };
    } else {
      out[t] = w >= 1 - 1e-12 ? { [rb.equityAsset]: 1 } : { [rb.equityAsset]: w, [def]: 1 - w };
    }
  }
  return out;
}

/**
 * Trailing compounded return over `n` days ending at t (inclusive); NaN unless
 * all `n` daily returns are known. Uses returns up to the close of t only.
 */
export function trailingReturn(r: Float64Array, n: number): Float64Array {
  const out = new Float64Array(r.length).fill(NaN);
  let logSum = 0;
  let finite = 0;
  for (let t = 0; t < r.length; t++) {
    const x = r[t]!;
    if (Number.isFinite(x)) {
      logSum += Math.log1p(x);
      finite++;
    }
    if (t >= n) {
      const old = r[t - n]!;
      if (Number.isFinite(old)) {
        logSum -= Math.log1p(old);
        finite--;
      }
    }
    if (t >= n - 1 && finite === n) out[t] = Math.expm1(logSum);
  }
  return out;
}

/**
 * Defensive trend filter (docs/PREREG-v4.md §2.3): on day t, each bond, gold or
 * utilities holding whose trailing `lookback`-day return is not above BIL's
 * moves to BIL. Where either trailing return is unknown the holding is kept.
 */
export function applyDefensiveTrend(targets: (Weights | null)[], assets: Record<string, AssetSeries>, lookback: number): (Weights | null)[] {
  const bil = trailingReturn(assets.BIL!.returns, lookback);
  const tr = new Map<string, Float64Array>();
  const trOf = (k: string) => {
    let x = tr.get(k);
    if (!x) tr.set(k, (x = assets[k] ? trailingReturn(assets[k]!.returns, lookback) : new Float64Array(targets.length).fill(NaN)));
    return x;
  };
  // reuse one object per distinct filtered result so 'regime' rebalancing sees stable targets
  const memo = new Map<Weights, Map<string, Weights>>();
  return targets.map((w, t) => {
    if (!w) return w;
    const failing: string[] = [];
    const f = filterDefensive(w, (k) => {
      const a = trOf(k)[t]!;
      const b = bil[t]!;
      const ok = !Number.isFinite(a) || !Number.isFinite(b) || a > b;
      if (!ok) failing.push(k);
      return ok;
    });
    if (f === w) return w;
    let m = memo.get(w);
    if (!m) memo.set(w, (m = new Map()));
    const key = failing.join(',');
    if (!m.has(key)) m.set(key, f);
    return m.get(key)!;
  });
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
  const baseReg = regimePath(score.score, p.regime);
  const rb = p.regime.rebound;
  const re = p.regime.reentry;
  const reg1 = rb?.enabled
    ? applyRebound(
        baseReg,
        cached(d, 'vixterm', () => {
          const a = d.series.VIX!;
          const b = d.series.VIX3M!;
          return a.map((x, i) => (b[i]! > 0 ? x / b[i]! : NaN));
        }),
        rb,
        d.series.SPX,
      )
    : baseReg;
  const reg = re?.enabled ? applyReentry(reg1, d.series.VIX!, d.series.VIX3M!, d.series.SPX!, re) : reg1;
  const override = new Int8Array(n);
  for (let t = 0; t < n; t++) {
    if (reg1[t] !== baseReg[t]) override[t] = OVERRIDE_REBOUND;
    else if (reg[t] !== reg1[t]) override[t] = OVERRIDE_REENTRY;
  }
  const assets = cached(d, 'assets' + JSON.stringify(p.assets), () => buildAssets(d, p.assets));
  const hedge = p.allocation.adaptiveHedge;
  const sbCorr = hedge?.enabled
    ? cached(d, `sbcorr${hedge.lookback}`, () => rollingCorrelation(assets.SPX!.returns, assets.IEF!.returns, Math.max(20, Math.round(hedge.lookback))))
    : undefined;
  const targets0 =
    p.allocation.mode === 'riskBudget' && p.allocation.riskBudget
      ? cached(d, 'rb' + JSON.stringify([p.assets, p.allocation.riskBudget]), () =>
          riskBudgetTargets(assets, p.allocation.riskBudget!, n, p.allocation.riskBudget!.recessionGate?.enabled ? d.series.UNRATE_GAP : undefined),
        )
      : strategyTargets(score.score, reg, p, sbCorr);
  const dt = p.allocation.defensiveTrend;
  const targets = dt?.enabled ? applyDefensiveTrend(targets0, assets, Math.max(21, Math.round(dt.lookback))) : targets0;
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
    const m = computeMetrics(d.dates, res.nav, res.start, res.end, cash, refNav, res.turnover, res.costs);
    const out: PortfolioRun = { id, label, result: res, metrics: m };
    if (oos > res.start + 21 && oos < res.end - 21) {
      out.inSample = computeMetrics(d.dates, res.nav, res.start, oos, cash, refNav, res.turnover, res.costs);
      out.outOfSample = computeMetrics(d.dates, res.nav, oos, res.end, cash, refNav, res.turnover, res.costs);
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
    scoreRegimes: baseReg,
    override,
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
