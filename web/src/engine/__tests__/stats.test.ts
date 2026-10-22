import { describe, expect, it } from 'vitest';
import { ema, normCdf, rollingMeanStd, rollingPercentile, sma } from '../stats';
import { rng } from './fixture';

function series(n: number, seed: number, nanEvery = 0): Float64Array {
  const r = rng(seed);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = nanEvery && i % nanEvery === 3 ? NaN : Math.round(r() * 50) / 10; // ties
  return x;
}

function brutePct(x: Float64Array, t: number, window: number, minP: number): number {
  const lo = window > 0 ? Math.max(0, t - window + 1) : 0;
  const w = Array.from(x.slice(lo, t + 1)).filter(Number.isFinite);
  if (!Number.isFinite(x[t]!) || w.length < minP) return NaN;
  const less = w.filter((v) => v < x[t]!).length;
  const eq = w.filter((v) => v === x[t]!).length;
  return (100 * (less + 0.5 * eq)) / w.length;
}

describe('rollingPercentile', () => {
  it.each([
    [50, 10],
    [0, 5],
  ])('matches brute force (window=%i)', (window, minP) => {
    const x = series(400, 3, 17);
    const got = rollingPercentile(x, window, minP);
    for (let t = 0; t < x.length; t++) {
      const want = brutePct(x, t, window, minP);
      if (Number.isNaN(want)) expect(got[t]).toBeNaN();
      else expect(got[t]).toBeCloseTo(want, 10);
    }
  });

  it('is causal: changing the future never changes the past', () => {
    const x = series(300, 5);
    const a = rollingPercentile(x, 60, 20);
    const y = Float64Array.from(x);
    for (let i = 200; i < y.length; i++) y[i] = 999;
    const b = rollingPercentile(y, 60, 20);
    expect(Array.from(b.slice(0, 200))).toEqual(Array.from(a.slice(0, 200)));
  });
});

describe('rollingMeanStd', () => {
  it('matches brute force', () => {
    const x = series(200, 9, 11);
    const { mean, std } = rollingMeanStd(x, 30, 10);
    for (let t = 0; t < x.length; t++) {
      const w = Array.from(x.slice(Math.max(0, t - 29), t + 1)).filter(Number.isFinite);
      if (w.length < 10) continue;
      const m = w.reduce((a, b) => a + b, 0) / w.length;
      const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (w.length - 1));
      expect(mean[t]).toBeCloseTo(m, 9);
      expect(std[t]).toBeCloseTo(sd, 9);
    }
  });
});

describe('smoothing and helpers', () => {
  it('ema with span 3 and restart on NaN', () => {
    const out = ema(Float64Array.from([1, 2, 3, NaN, 5]), 3);
    expect(out[0]).toBe(1);
    expect(out[1]).toBeCloseTo(1.5);
    expect(out[2]).toBeCloseTo(2.25);
    expect(out[3]).toBeNaN();
    expect(out[4]).toBe(5);
  });
  it('sma requires a full window', () => {
    const out = sma(Float64Array.from([1, 2, 3, 4]), 3);
    expect(out[1]).toBeNaN();
    expect(out[2]).toBe(2);
    expect(out[3]).toBe(3);
  });
  it('normCdf', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 7);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 4);
  });
});
