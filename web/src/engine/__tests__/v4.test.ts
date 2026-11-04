import { describe, expect, it } from 'vitest';
import { filterDefensive } from '../allocation';
import type { AssetSeries } from '../assets';
import { COMPONENT_BY_ID } from '../components';
import { BASE_PARAMS, DEFAULT_PARAMS, merge, V4_PATCH } from '../params';
import { applyDefensiveTrend, run, trailingReturn } from '../run';
import { makeFixture } from './fixture';

const series = (rets: number[]): AssetSeries => ({ key: 'x', label: 'x', returns: Float64Array.from(rets), synthetic: new Uint8Array(rets.length), first: 0 });

describe('v4 building blocks', () => {
  it('trailingReturn compounds exactly the last n returns, NaN until n are known', () => {
    const r = trailingReturn(Float64Array.from([NaN, 0.1, 0.1, -0.5, 0.2]), 2);
    expect(Number.isNaN(r[1]!)).toBe(true);
    expect(r[2]).toBeCloseTo(0.21, 12);
    expect(r[3]).toBeCloseTo(1.1 * 0.5 - 1, 12);
    expect(r[4]).toBeCloseTo(0.5 * 1.2 - 1, 12);
  });

  it('filterDefensive moves only failing bond/gold/utilities weight to BIL', () => {
    const w = { SPX: 0.8, IEF: 0.2 };
    expect(filterDefensive(w, () => true)).toBe(w);
    expect(filterDefensive(w, (k) => k !== 'IEF')).toEqual({ SPX: 0.8, BIL: 0.2 });
    expect(filterDefensive({ IEF: 0.5, GLD: 0.25, XLU: 0.25 }, (k) => k === 'GLD')).toEqual({ GLD: 0.25, BIL: 0.75 });
  });

  it('applyDefensiveTrend uses trailing returns up to the decision day only', () => {
    // IEF beats BIL over 2 days until day 3, then loses
    const assets = { BIL: series([0, 0.001, 0.001, 0.001, 0.001, 0.001]), IEF: series([0, 0.01, 0.01, -0.03, -0.01, 0.0]) };
    const w = { SPX: 0.8, IEF: 0.2 };
    const out = applyDefensiveTrend(new Array(6).fill(w), assets as never, 2);
    expect(out[1]).toBe(w); // trailing return not yet known: kept
    expect(out[2]).toBe(w);
    expect(out[3]).toEqual({ SPX: 0.8, BIL: 0.2 });
    expect(out[4]).toBe(out[3]); // same filtered result reuses one object
  });

  it('momentum components are registered, off by default, and causal', () => {
    for (const id of ['mom_1m', 'mom_3m', 'mom_12m']) {
      const c = COMPONENT_BY_ID[id]!;
      expect(c.defaultEnabled).toBe(false);
      expect(BASE_PARAMS.score.components[id]!.enabled).toBe(false);
    }
    const d = makeFixture();
    const m = COMPONENT_BY_ID.mom_1m!.compute(d);
    const px = d.series.SPX!;
    expect(m[30]).toBeCloseTo(100 * (px[30]! / px[9]! - 1), 10);
    expect(Number.isNaN(m[20]!)).toBe(true);
  });

  it('defaults and frozen-record base are unchanged by the new options', () => {
    expect(BASE_PARAMS.allocation.defensiveTrend?.enabled).toBe(false);
    expect(DEFAULT_PARAMS.allocation.defensiveTrend?.enabled).toBe(false);
    const d = makeFixture();
    const p = merge(DEFAULT_PARAMS, { period: { start: '2010-01-01' } });
    const a = run(d, p);
    const b = run(d, merge(p, { allocation: { defensiveTrend: { enabled: false, lookback: 21 } } }));
    expect(b.targets).toEqual(a.targets);
  });

  it('the v4 patch runs end to end', () => {
    const r = run(makeFixture(), merge(merge(DEFAULT_PARAMS, V4_PATCH), { period: { start: '2010-01-01' } }));
    expect(r.strategy.metrics.years).toBeGreaterThan(1);
  });
});
