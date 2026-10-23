import { describe, expect, it } from 'vitest';
import type { MarketData } from '../data';
import { expandingMedian, usV3Market, V3_PARAMS, v3Run, v3Signal } from '../v3';
import { makeFixture } from './fixture';

describe('v3 building blocks', () => {
  it('expanding median is causal and correct', () => {
    const x = Float64Array.from([3, NaN, 1, 2, 10, 4]);
    expect(Array.from(expandingMedian(x, 2))).toEqual([NaN, NaN, 2, 2, 2.5, 3]);
  });

  it('equity weight stays within 60% +/- 20% and pillars within [-1, 1]', () => {
    const m = usV3Market(makeFixture(1500));
    const s = v3Signal(m);
    let seen = 0;
    for (let t = 0; t < s.s.length; t++) {
      if (!Number.isFinite(s.s[t]!)) continue;
      seen++;
      for (const p of [s.p1, s.p2, s.p3]) expect(Math.abs(p[t]!)).toBeLessThanOrEqual(1 + 1e-12);
      expect(s.equityWeight[t]!).toBeGreaterThanOrEqual(0.4 - 1e-12);
      expect(s.equityWeight[t]!).toBeLessThanOrEqual(0.8 + 1e-12);
      expect(s.equityWeight[t]!).toBeCloseTo(0.6 + 0.2 * s.s[t]!, 12);
    }
    expect(seen).toBeGreaterThan(500);
  });

  it('trend pillar saturates at +/-10% from the 200-day average', () => {
    const n = 600;
    const idx = Float64Array.from({ length: n }, (_, i) => (i < 400 ? 100 : 130));
    const m = { ...usV3Market(makeFixture(n)), index: idx };
    const s = v3Signal(m);
    expect(s.p2[399]).toBeCloseTo(0, 12);
    expect(s.p2[400]).toBe(1); // 130 vs a 200-day average of 100.15 -> +29.8%
  });
});

describe('v3 has no look-ahead', () => {
  const full = makeFixture(1500);
  const T = 1100;
  const cut = (d: MarketData): MarketData => {
    // change everything after T: results up to T must not move
    const series = Object.fromEntries(Object.entries(d.series).map(([k, v]) => [k, v.map((x, i) => (i > T ? x * 1.7 + 3 : x))]));
    const assets = Object.fromEntries(Object.entries(d.assets).map(([k, a]) => [k, { ...a, tr: a.tr.map((x, i) => (i > T ? x * (1 + 0.01 * (i - T)) : x)) }]));
    return { ...d, series, assets } as MarketData;
  };
  const a = v3Run(usV3Market(full));
  const b = v3Run(usV3Market(cut(full)));
  it('signal and targets up to T are unchanged', () => {
    for (const k of ['p1', 'p2', 'p3', 's', 'equityWeight'] as const) {
      for (let t = 0; t <= T; t++) {
        const x = a.signal[k][t]!;
        const y = b.signal[k][t]!;
        if (Number.isNaN(x)) expect(y).toBeNaN();
        else expect(y, `${k}[${t}]`).toBe(x);
      }
    }
  });
  it('strategy NAV up to T is unchanged', () => {
    for (let t = a.start; t <= T; t++) expect(b.strategy.nav[t], `nav[${t}]`).toBe(a.strategy.nav[t]);
    expect(a.strategy.missingReturnDays).toBe(0);
    expect(V3_PARAMS.lag).toBeGreaterThanOrEqual(1);
  });
});
