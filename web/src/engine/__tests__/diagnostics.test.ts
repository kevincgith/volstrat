import { describe, expect, it } from 'vitest';
import { conditionalReturns, informationCoefficient, scoreBuckets } from '../diagnostics';

describe('conditionalReturns', () => {
  it('pairs the label at t with the return at t + lag + 1', () => {
    // labels alternate 0/1; returns are +1% on even days, -1% on odd days
    const n = 40;
    const labels = Int8Array.from({ length: n }, (_, t) => t % 2);
    const r = Float64Array.from({ length: n }, (_, t) => (t % 2 === 0 ? 0.01 : -0.01));
    const lag1 = conditionalReturns(labels, r, 2, 1, 0, n - 1, 2);
    // lag 1: label at t -> return at t+2 (same parity): group 0 gets +1%, group 1 gets -1%
    expect(lag1.groups[0]!.annReturn).toBeCloseTo(0.01 * 252);
    expect(lag1.groups[1]!.annReturn).toBeCloseTo(-0.01 * 252);
    const lag2 = conditionalReturns(labels, r, 2, 2, 0, n - 1, 2);
    // lag 2: label at t -> return at t+3 (opposite parity)
    expect(lag2.groups[0]!.annReturn).toBeCloseTo(-0.01 * 252);
  });

  it('ignores unlabelled days and computes forward tail share', () => {
    const labels = Int8Array.from([-1, 0, 0, 0, 0, 0, 0, 0]);
    const r = Float64Array.from([0, 0, 0, -0.2, 0, 0, 0, 0]);
    const res = conditionalReturns(labels, r, 1, 1, 0, 7, 2);
    expect(res.all.days).toBe(5); // t=1..5 have a return at t+2
    expect(res.groups[0]!.fwdTail).toBeGreaterThan(0);
  });
});

describe('scoreBuckets / IC', () => {
  it('buckets scores in 20-point bands', () => {
    expect(Array.from(scoreBuckets(Float64Array.from([0, 19.9, 20, 59, 80, 100, NaN])))).toEqual([0, 0, 1, 2, 4, 4, -1]);
  });

  it('IC is +1 when the score perfectly ranks forward returns', () => {
    const n = 21 * 40;
    const score = new Float64Array(n);
    const r = new Float64Array(n);
    for (let t = 0; t < n; t++) {
      score[t] = Math.sin(t / 50) * 50 + 50;
    }
    // forward return over [t+2, t+22] proportional to score at t
    for (let t = 0; t + 2 < n; t++) r[t + 2] = (score[t]! - 50) / 1e5;
    const ic = informationCoefficient(score, r, 1, 0, n - 1, 1);
    expect(ic.ic).toBeGreaterThan(0.99);
  });
});
