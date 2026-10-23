/**
 * Equal-risk comparison: the strategy's daily returns scaled by a constant k so
 * its volatility over [s, e] matches a benchmark's. The scaled share above 100%
 * is financed at T-bills + spread; below 100% the rest earns T-bills.
 *
 * This is a yardstick, not a tradeable strategy: k is set with the whole
 * period's volatility (hindsight). It answers whether lower drawdowns come from
 * timing or simply from holding less risk.
 */

import { computeMetrics, type Metrics } from './metrics';

export interface EqualRiskRow {
  id: string;
  label: string;
  /** Constant scale applied to the strategy's returns. */
  k: number;
  scaled: Metrics;
  bench: Metrics;
}

/** NAV of k x the strategy, financed (or topped up with cash) at cash + spread above 1x. */
export function scaledNav(rets: Float64Array, cash: Float64Array, k: number, spread: number, s: number, e: number): Float64Array {
  const nav = new Float64Array(rets.length).fill(NaN);
  nav[s] = 1;
  for (let t = s + 1; t <= e; t++) {
    const c = Number.isFinite(cash[t]!) ? cash[t]! : 0;
    const r = Number.isFinite(rets[t]!) ? rets[t]! : 0;
    const fin = k > 1 ? c + spread / 252 : c;
    nav[t] = nav[t - 1]! * (1 + k * r - (k - 1) * fin);
  }
  return nav;
}

function vol(rets: Float64Array, s: number, e: number): number {
  let m = 0;
  let m2 = 0;
  let n = 0;
  for (let t = s + 1; t <= e; t++) {
    const x = rets[t]!;
    if (!Number.isFinite(x)) continue;
    m += x;
    m2 += x * x;
    n++;
  }
  return n > 1 ? Math.sqrt(Math.max(0, m2 / n - (m / n) ** 2)) : NaN;
}

export function equalRisk(
  dates: string[],
  strategy: { returns: Float64Array },
  benchmarks: { id: string; label: string; result: { returns: Float64Array; nav: Float64Array } }[],
  cash: Float64Array,
  spread: number,
  s: number,
  e: number,
): EqualRiskRow[] {
  const sv = vol(strategy.returns, s, e);
  const ref = benchmarks[0]!.result.nav;
  return benchmarks.map((b) => {
    const k = vol(b.result.returns, s, e) / sv;
    const nav = scaledNav(strategy.returns, cash, k, spread, s, e);
    return {
      id: b.id,
      label: b.label,
      k,
      scaled: computeMetrics(dates, nav, s, e, cash, ref),
      bench: computeMetrics(dates, b.result.nav, s, e, cash, ref),
    };
  });
}
