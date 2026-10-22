/**
 * Stationary block bootstrap (Politis & Romano, 1994) of paired daily returns.
 *
 * Strategy and benchmark are resampled on the SAME day indices, preserving
 * their correlation, and blocks of geometric length (mean `blockLen`) preserve
 * volatility clustering. Answers: how confident can we be that the strategy's
 * Sharpe (or CAGR) edge over the benchmark is not luck?
 */

const DAYS = 252;

export interface BootstrapResult {
  n: number; // resamples
  days: number;
  blockLen: number;
  sharpeDiff: { p5: number; p50: number; p95: number; probPositive: number };
  cagrDiff: { p5: number; p50: number; p95: number; probPositive: number };
  mddStrategy: { p5: number; p50: number; p95: number };
  mddBenchmark: { p5: number; p50: number; p95: number };
  observed: { sharpeDiff: number; cagrDiff: number };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

function summary(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return { p5: quantile(s, 0.05), p50: quantile(s, 0.5), p95: quantile(s, 0.95), probPositive: xs.filter((x) => x > 0).length / xs.length };
}

function pathStats(r: ArrayLike<number>, cash: ArrayLike<number>) {
  const n = r.length;
  let m = 0;
  let m2 = 0;
  let logG = 0;
  let peak = 0;
  let mdd = 0;
  for (let i = 0; i < n; i++) {
    const ex = r[i]! - cash[i]!;
    m += ex;
    m2 += ex * ex;
    logG += Math.log(1 + r[i]!);
    peak = Math.max(peak, logG);
    mdd = Math.min(mdd, Math.exp(logG - peak) - 1);
  }
  const mean = m / n;
  const sd = Math.sqrt(Math.max(0, (m2 - n * mean * mean) / (n - 1)));
  return { sharpe: sd > 0 ? (mean / sd) * Math.sqrt(DAYS) : NaN, cagr: Math.exp((logG / n) * DAYS) - 1, mdd };
}

export function pairedBootstrap(
  strat: ArrayLike<number>,
  bench: ArrayLike<number>,
  cash: ArrayLike<number>,
  opts: { n?: number; blockLen?: number; seed?: number } = {},
): BootstrapResult {
  const N = opts.n ?? 1000;
  const L = Math.max(1, opts.blockLen ?? 21);
  const T = strat.length;
  const rand = mulberry32(opts.seed ?? 12345);
  const rs = new Float64Array(T);
  const rb = new Float64Array(T);
  const rc = new Float64Array(T);
  const sd: number[] = [];
  const cd: number[] = [];
  const ms: number[] = [];
  const mb: number[] = [];
  const pNew = 1 / L;
  for (let b = 0; b < N; b++) {
    let idx = Math.floor(rand() * T);
    for (let i = 0; i < T; i++) {
      if (i > 0) idx = rand() < pNew ? Math.floor(rand() * T) : (idx + 1) % T;
      rs[i] = strat[idx]!;
      rb[i] = bench[idx]!;
      rc[i] = cash[idx]!;
    }
    const a = pathStats(rs, rc);
    const c = pathStats(rb, rc);
    sd.push(a.sharpe - c.sharpe);
    cd.push(a.cagr - c.cagr);
    ms.push(a.mdd);
    mb.push(c.mdd);
  }
  const oa = pathStats(strat, cash);
  const ob = pathStats(bench, cash);
  const strip = (x: ReturnType<typeof summary>) => ({ p5: x.p5, p50: x.p50, p95: x.p95 });
  return {
    n: N,
    days: T,
    blockLen: L,
    sharpeDiff: summary(sd),
    cagrDiff: summary(cd),
    mddStrategy: strip(summary(ms)),
    mddBenchmark: strip(summary(mb)),
    observed: { sharpeDiff: oa.sharpe - ob.sharpe, cagrDiff: oa.cagr - ob.cagr },
  };
}
