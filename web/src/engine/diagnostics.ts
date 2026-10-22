/**
 * Signal diagnostics: how did an asset behave AFTER each signal state?
 *
 * The label known at the close of day t (regime or score bucket) is paired with
 * the asset's return on day t + lag + 1, the first return a trade on that label
 * could earn. This is independent of the portfolio mapping, so it isolates
 * whether the signal itself separates good from bad environments.
 */

const DAYS = 252;

export interface GroupStats {
  group: number;
  days: number;
  share: number;
  annReturn: number; // mean daily return x 252
  vol: number; // annualised
  sharpe: number; // mean / sd x sqrt(252), not excess of cash
  upDays: number; // share of positive days
  worstDay: number;
  /** Mean forward cumulative return over `horizon` days (overlapping windows). */
  fwdMean: number;
  /** Share of forward windows with a loss worse than `tailLoss`. */
  fwdTail: number;
}

export interface ConditionalResult {
  groups: GroupStats[];
  all: GroupStats;
  from: number;
  to: number;
  horizon: number;
  tailLoss: number;
}

function stats(group: number, r: number[], fwd: number[], total: number, tailLoss: number): GroupStats {
  const n = r.length;
  const mean = n ? r.reduce((a, b) => a + b, 0) / n : NaN;
  const sd = n > 1 ? Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : NaN;
  return {
    group,
    days: n,
    share: total ? n / total : 0,
    annReturn: mean * DAYS,
    vol: sd * Math.sqrt(DAYS),
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(DAYS) : NaN,
    upDays: n ? r.filter((x) => x > 0).length / n : NaN,
    worstDay: n ? Math.min(...r) : NaN,
    fwdMean: fwd.length ? fwd.reduce((a, b) => a + b, 0) / fwd.length : NaN,
    fwdTail: fwd.length ? fwd.filter((x) => x < tailLoss).length / fwd.length : NaN,
  };
}

/**
 * @param labels  group index per day (negative = no label)
 * @param returns asset daily returns
 * @param lag     execution lag (label at t -> return at t + lag + 1)
 */
export function conditionalReturns(
  labels: ArrayLike<number>,
  returns: Float64Array,
  nGroups: number,
  lag: number,
  from: number,
  to: number,
  horizon = 63,
  tailLoss = -0.1,
): ConditionalResult {
  const daily: number[][] = Array.from({ length: nGroups }, () => []);
  const fwd: number[][] = Array.from({ length: nGroups }, () => []);
  const allDaily: number[] = [];
  const allFwd: number[] = [];
  const off = Math.max(1, lag) + 1;
  for (let t = from; t <= to; t++) {
    const g = labels[t]!;
    if (!(g >= 0 && g < nGroups)) continue;
    const r = returns[t + off];
    if (r === undefined || !Number.isFinite(r)) continue;
    daily[g]!.push(r);
    allDaily.push(r);
    // forward cumulative return over the next `horizon` tradable days
    if (t + off + horizon - 1 < returns.length) {
      let g1 = 1;
      let ok = true;
      for (let k = 0; k < horizon; k++) {
        const x = returns[t + off + k]!;
        if (!Number.isFinite(x)) {
          ok = false;
          break;
        }
        g1 *= 1 + x;
      }
      if (ok) {
        fwd[g]!.push(g1 - 1);
        allFwd.push(g1 - 1);
      }
    }
  }
  const total = allDaily.length;
  return {
    groups: daily.map((r, g) => stats(g, r, fwd[g]!, total, tailLoss)),
    all: stats(-1, allDaily, allFwd, total, tailLoss),
    from,
    to,
    horizon,
    tailLoss,
  };
}

/** Fixed 20-point score buckets: 0 = [0,20) ... 4 = [80,100]. */
export function scoreBuckets(score: Float64Array): Int8Array {
  const out = new Int8Array(score.length).fill(-1);
  for (let t = 0; t < score.length; t++) {
    const s = score[t]!;
    if (Number.isFinite(s)) out[t] = Math.min(4, Math.max(0, Math.floor(s / 20)));
  }
  return out;
}

function ranks(x: number[]): number[] {
  const idx = x.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(x.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]![1]] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let c = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    c += (a[i]! - ma) * (b[i]! - mb);
    va += (a[i]! - ma) ** 2;
    vb += (b[i]! - mb) ** 2;
  }
  return c / Math.sqrt(va * vb);
}

export interface InformationCoefficient {
  ic: number; // Spearman rank correlation, score vs forward return
  tStat: number;
  n: number; // non-overlapping observations
  horizon: number;
}

/**
 * Spearman IC between the score at t and the asset's forward `horizon`-day
 * return starting at t + lag + 1, sampled every `horizon` days so the
 * observations do not overlap (valid t-stat ~ ic * sqrt((n-2)/(1-ic^2))).
 */
export function informationCoefficient(
  score: Float64Array,
  returns: Float64Array,
  lag: number,
  from: number,
  to: number,
  horizon = 21,
): InformationCoefficient {
  const s: number[] = [];
  const f: number[] = [];
  const off = Math.max(1, lag) + 1;
  for (let t = from; t + off + horizon - 1 <= to; t += horizon) {
    if (!Number.isFinite(score[t]!)) continue;
    let g = 1;
    let ok = true;
    for (let k = 0; k < horizon; k++) {
      const x = returns[t + off + k]!;
      if (!Number.isFinite(x)) {
        ok = false;
        break;
      }
      g *= 1 + x;
    }
    if (!ok) continue;
    s.push(score[t]!);
    f.push(g - 1);
  }
  const n = s.length;
  if (n < 10) return { ic: NaN, tStat: NaN, n, horizon };
  const ic = pearson(ranks(s), ranks(f));
  return { ic, tStat: ic * Math.sqrt((n - 2) / Math.max(1e-12, 1 - ic * ic)), n, horizon };
}
