/**
 * Causal time-series statistics. Every function's output at index t depends
 * only on inputs at indices <= t. NaN marks missing values throughout.
 */

const SQRT252 = Math.sqrt(252);

function lowerBound(a: number[], x: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (a[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(a: number[], x: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (a[mid]! <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Percentile rank (0-100) of x[t] among the finite values in the trailing
 * window x[t-window+1 .. t] (or all of x[0..t] when window <= 0, i.e.
 * expanding). Ties count half. NaN until `minPeriods` finite values exist.
 */
export function rollingPercentile(x: Float64Array, window: number, minPeriods: number): Float64Array {
  const n = x.length;
  const out = new Float64Array(n).fill(NaN);
  const sorted: number[] = [];
  for (let t = 0; t < n; t++) {
    const v = x[t]!;
    if (Number.isFinite(v)) sorted.splice(lowerBound(sorted, v), 0, v);
    if (window > 0 && t - window >= 0) {
      const old = x[t - window]!;
      if (Number.isFinite(old)) sorted.splice(lowerBound(sorted, old), 1);
    }
    if (!Number.isFinite(v) || sorted.length < minPeriods) continue;
    const less = lowerBound(sorted, v);
    const equal = upperBound(sorted, v) - less;
    out[t] = (100 * (less + 0.5 * equal)) / sorted.length;
  }
  return out;
}

/** Rolling (window > 0) or expanding (window <= 0) mean and sample std over finite values. */
export function rollingMeanStd(
  x: Float64Array,
  window: number,
  minPeriods: number,
): { mean: Float64Array; std: Float64Array } {
  const n = x.length;
  const mean = new Float64Array(n).fill(NaN);
  const std = new Float64Array(n).fill(NaN);
  let s = 0;
  let s2 = 0;
  let c = 0;
  for (let t = 0; t < n; t++) {
    const v = x[t]!;
    if (Number.isFinite(v)) {
      s += v;
      s2 += v * v;
      c++;
    }
    if (window > 0 && t - window >= 0) {
      const o = x[t - window]!;
      if (Number.isFinite(o)) {
        s -= o;
        s2 -= o * o;
        c--;
      }
    }
    if (c >= Math.max(minPeriods, 2)) {
      const m = s / c;
      mean[t] = m;
      std[t] = Math.sqrt(Math.max(0, (s2 - c * m * m) / (c - 1)));
    }
  }
  return { mean, std };
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26, |error| < 1.5e-7). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Z-score against trailing mean/std, mapped through the normal CDF to 0-100. */
export function rollingZPercentile(x: Float64Array, window: number, minPeriods: number): Float64Array {
  const { mean, std } = rollingMeanStd(x, window, minPeriods);
  const out = new Float64Array(x.length).fill(NaN);
  for (let t = 0; t < x.length; t++) {
    const sd = std[t]!;
    if (Number.isFinite(x[t]!) && Number.isFinite(sd) && sd > 0) {
      out[t] = 100 * normCdf((x[t]! - mean[t]!) / sd);
    }
  }
  return out;
}

/** Simple moving average over the last `n` values; NaN if any is missing. */
export function sma(x: Float64Array, n: number): Float64Array {
  const out = new Float64Array(x.length).fill(NaN);
  let s = 0;
  let bad = 0;
  for (let t = 0; t < x.length; t++) {
    const v = x[t]!;
    if (Number.isFinite(v)) s += v;
    else bad++;
    if (t >= n) {
      const o = x[t - n]!;
      if (Number.isFinite(o)) s -= o;
      else bad--;
    }
    if (t >= n - 1 && bad === 0) out[t] = s / n;
  }
  return out;
}

/**
 * Exponential moving average with span `n` (alpha = 2/(n+1)). A missing input
 * yields NaN and restarts the average. n <= 1 returns a copy.
 */
export function ema(x: Float64Array, n: number): Float64Array {
  if (n <= 1) return Float64Array.from(x);
  const a = 2 / (n + 1);
  const out = new Float64Array(x.length).fill(NaN);
  let prev = NaN;
  for (let t = 0; t < x.length; t++) {
    const v = x[t]!;
    if (!Number.isFinite(v)) {
      prev = NaN;
      continue;
    }
    prev = Number.isFinite(prev) ? a * v + (1 - a) * prev : v;
    out[t] = prev;
  }
  return out;
}

/** Simple returns from a price / total-return index. */
export function returnsFromIndex(px: Float64Array): Float64Array {
  const out = new Float64Array(px.length).fill(NaN);
  for (let t = 1; t < px.length; t++) {
    const a = px[t - 1]!;
    const b = px[t]!;
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0) out[t] = b / a - 1;
  }
  return out;
}

/** Annualised realised volatility (in vol points, i.e. x100) of log returns over `n` days. */
export function realisedVol(px: Float64Array, n: number): Float64Array {
  const lr = new Float64Array(px.length).fill(NaN);
  for (let t = 1; t < px.length; t++) {
    const a = px[t - 1]!;
    const b = px[t]!;
    if (a > 0 && b > 0) lr[t] = Math.log(b / a);
  }
  const { std } = rollingMeanStd(lr, n, n);
  return std.map((s) => s * SQRT252 * 100);
}

/** x[t] - x[t-n] (difference over n observations). */
export function diff(x: Float64Array, n: number): Float64Array {
  const out = new Float64Array(x.length).fill(NaN);
  for (let t = n; t < x.length; t++) out[t] = x[t]! - x[t - n]!;
  return out;
}

/** Element-wise combination with NaN propagation. */
export function zip2(a: Float64Array, b: Float64Array, f: (x: number, y: number) => number): Float64Array {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = f(a[i]!, b[i]!);
  return out;
}
