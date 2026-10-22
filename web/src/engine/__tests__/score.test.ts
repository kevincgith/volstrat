import { describe, expect, it } from 'vitest';
import { composite, rawRegime, regimes, type ComponentResult } from '../score';
import { COMPONENT_BY_ID } from '../components';

const TH: [number, number, number, number] = [20, 40, 60, 80];

describe('regimes', () => {
  it('maps scores to five buckets', () => {
    expect([0, 19.9, 20, 45, 60, 80, 100].map((s) => rawRegime(s, TH))).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });

  it('hysteresis suppresses small crossings', () => {
    const s = Float64Array.from([50, 61, 59, 63, 57, 61, 39, 37]);
    expect(Array.from(regimes(s, { thresholds: TH, hysteresis: 2.5 }))).toEqual([2, 2, 2, 3, 2, 2, 2, 1]);
    expect(Array.from(regimes(s, { thresholds: TH, hysteresis: 0 }))).toEqual([2, 3, 2, 3, 2, 3, 1, 1]);
  });

  it('can jump several regimes in one day', () => {
    const s = Float64Array.from([85, 10]);
    expect(Array.from(regimes(s, { thresholds: TH, hysteresis: 2.5 }))).toEqual([4, 0]);
  });
});

describe('composite', () => {
  const mk = (id: string, vals: number[]): ComponentResult => ({
    def: COMPONENT_BY_ID[id]!,
    raw: Float64Array.from(vals),
    score: Float64Array.from(vals),
  });
  it('renormalises weights over available components and enforces coverage', () => {
    const comps = [mk('vix', [80, 80, NaN]), mk('trend', [20, NaN, NaN])];
    const settings = {
      vix: { enabled: true, weight: 3, invert: false },
      trend: { enabled: true, weight: 1, invert: false },
    };
    const { composite: c, coverage } = composite(comps, settings, 3, 0.5);
    expect(c[0]).toBeCloseTo(65); // (3*80 + 1*20) / 4
    expect(c[1]).toBe(80); // trend missing: vix alone, coverage 0.75
    expect(coverage[1]).toBeCloseTo(0.75);
    expect(c[2]).toBeNaN();
  });
});
