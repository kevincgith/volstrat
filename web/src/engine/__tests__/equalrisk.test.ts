import { describe, expect, it } from 'vitest';
import { equalRisk, scaledNav } from '../equalrisk';

describe('equal-risk scaling', () => {
  const n = 300;
  const dates = Array.from({ length: n }, (_, i) => new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10));
  const cash = new Float64Array(n).fill(0.0001);
  const strat = Float64Array.from({ length: n }, (_, i) => (i === 0 ? NaN : 0.005 * Math.sin(i * 1.3)));
  const bench = Float64Array.from(strat, (x) => 2 * x);
  const nav = (r: Float64Array) => {
    const v = new Float64Array(n).fill(NaN);
    v[0] = 1;
    for (let t = 1; t < n; t++) v[t] = v[t - 1]! * (1 + r[t]!);
    return v;
  };

  it('1x reproduces the strategy and financing applies only above 1x', () => {
    const one = scaledNav(strat, cash, 1, 0.0075, 0, n - 1);
    expect(one[n - 1]).toBeCloseTo(nav(strat)[n - 1]!, 12);
    const half = scaledNav(strat, cash, 0.5, 0.0075, 0, n - 1);
    expect(half[1]).toBeCloseTo(1 + 0.5 * strat[1]! + 0.5 * cash[1]!, 12);
    const two = scaledNav(strat, cash, 2, 0.0075, 0, n - 1);
    expect(two[1]).toBeCloseTo(1 + 2 * strat[1]! - (cash[1]! + 0.0075 / 252), 12);
  });

  it('matches the benchmark volatility', () => {
    const rows = equalRisk(dates, { returns: strat }, [{ id: 'b', label: 'B', result: { returns: bench, nav: nav(bench) } }], cash, 0.0075, 0, n - 1);
    expect(rows[0]!.k).toBeCloseTo(2, 10);
    expect(rows[0]!.scaled.vol).toBeCloseTo(rows[0]!.bench.vol, 6);
  });
});
