import { describe, expect, it } from 'vitest';
import { pairedBootstrap } from '../bootstrap';
import { rng } from './fixture';

function noise(n: number, seed: number, mean: number, sd: number) {
  const r = rng(seed);
  return Float64Array.from({ length: n }, () => mean + sd * ((r() + r() + r() + r() - 2) * Math.sqrt(3)));
}

describe('pairedBootstrap', () => {
  const n = 2520;
  const cash = new Float64Array(n);
  it('is deterministic for a seed and centred on the observed difference', () => {
    const a = noise(n, 1, 0.0005, 0.01);
    const b = noise(n, 2, 0.0002, 0.01);
    const r1 = pairedBootstrap(a, b, cash, { n: 300, seed: 7 });
    const r2 = pairedBootstrap(a, b, cash, { n: 300, seed: 7 });
    expect(r1.sharpeDiff).toEqual(r2.sharpeDiff);
    expect(r1.sharpeDiff.p5).toBeLessThan(r1.observed.sharpeDiff);
    expect(r1.sharpeDiff.p95).toBeGreaterThan(r1.observed.sharpeDiff);
  });

  it('a strategy identical to its benchmark has zero difference', () => {
    const a = noise(n, 3, 0.0004, 0.01);
    const r = pairedBootstrap(a, a, cash, { n: 100 });
    expect(r.sharpeDiff.p5).toBe(0);
    expect(r.sharpeDiff.p95).toBe(0);
  });

  it('detects a large, persistent edge', () => {
    const b = noise(n, 4, 0.0002, 0.01);
    const a = Float64Array.from(b, (x) => x + 0.001);
    const r = pairedBootstrap(a, b, cash, { n: 300 });
    expect(r.sharpeDiff.probPositive).toBe(1);
  });
});
