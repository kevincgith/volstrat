import { describe, expect, it } from 'vitest';
import type { AssetSeries } from '../assets';
import { simulate } from '../backtest';
import { costSensitivity } from '../costs';
import { DEFAULT_PARAMS, merge } from '../params';
import { regimes } from '../score';
import { bdays, makeFixture } from './fixture';

// a single cut-off at 50 (others out of reach) isolates the Neutral(2) / Risk-On(3) boundary
const TH: [number, number, number, number] = [-1, 0, 50, 101];

describe('asymmetric buffers (user example: up at 50, back down only below 45)', () => {
  const s = Float64Array.from([49, 51, 48, 46, 44, 49, 51]);
  it('switches up at the cut-off and back only after a 5-point drop', () => {
    const r = regimes(s, { thresholds: TH, hysteresis: 0, bufferUp: 0, bufferDown: 5 });
    expect(Array.from(r)).toEqual([2, 3, 3, 3, 2, 2, 3]);
  });
  it('symmetric zero buffer whipsaws on every crossing', () => {
    const r = regimes(s, { thresholds: TH, hysteresis: 0 });
    expect(Array.from(r)).toEqual([2, 3, 2, 2, 2, 2, 3]);
  });
  it('falls back to hysteresis when buffers are not set', () => {
    expect(Array.from(regimes(s, { thresholds: TH, hysteresis: 5 }))).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });
});

describe('minimum holding period', () => {
  const s = Float64Array.from([60, 40, 60, 40, 40, 40, 60, 60]);
  it('blocks changes until the hold has elapsed', () => {
    const r = regimes(s, { thresholds: TH, hysteresis: 0, minHoldDays: 3, fastDerisk: false });
    expect(Array.from(r)).toEqual([3, 3, 3, 2, 2, 2, 3, 3]);
  });
  it('still de-risks immediately when fastDerisk is on', () => {
    const r = regimes(s, { thresholds: TH, hysteresis: 0, minHoldDays: 3, fastDerisk: true });
    expect(Array.from(r)).toEqual([3, 2, 2, 2, 2, 2, 3, 3]);
  });
});

describe('per-asset costs', () => {
  const dates = bdays('2024-01-01', 8);
  const n = dates.length;
  const a = (k: string): AssetSeries => ({ key: k, label: k, returns: new Float64Array(n), synthetic: new Uint8Array(n), first: 0 });
  const assets = { SPX: a('SPX'), SSO: a('SSO') };
  const targets = dates.map((_, i) => (i < 3 ? { SPX: 1 } : { SSO: 1 }));
  it('charges each leg at its own rate', () => {
    const res = simulate(dates, assets, targets, { lag: 1, rebalance: 'regime', band: 0, costBps: 5, assetCostBps: { SSO: 20 } }, 0, n - 1);
    expect(res.costs[4]).toBeCloseTo(0.0005 + 0.002, 12); // sell SPX at 5bp, buy SSO at 20bp
  });
});

describe('cost sensitivity', () => {
  it('Sharpe falls as costs rise and the break-even is consistent', () => {
    const d = makeFixture(1200);
    const p = merge(DEFAULT_PARAMS, { period: { start: '2010-01-01' }, score: { window: 252, minPeriods: 126, smoothing: 1 }, regime: { hysteresis: 0 } });
    const r = costSensitivity(d, p, 'spx', [0, 10, 50]);
    expect(r.points[0]!.sharpe).toBeGreaterThan(r.points[2]!.sharpe);
    expect(r.points[2]!.costDrag).toBeGreaterThan(r.points[1]!.costDrag);
    if (r.breakEven !== null) expect(r.breakEven).toBeGreaterThan(0);
  });
});

describe('rebound overlay', () => {
  it('lifts risk-off regimes after a panic inversion normalises, for `hold` days', async () => {
    const { applyRebound } = await import('../score');
    const reg = Int8Array.from([1, 0, 0, 0, 0, 0, 1, 1]);
    const ratio = Float64Array.from([0.9, 1.2, 1.15, 0.98, 0.95, 0.95, 0.95, 0.95]);
    const out = applyRebound(reg, ratio, { enabled: true, peak: 1.1, lookback: 20, normal: 1.0, hold: 3, toRegime: 2 });
    expect(Array.from(out)).toEqual([1, 0, 0, 2, 2, 2, 1, 1]);
  });
  it('a fresh inversion cancels the override', async () => {
    const { applyRebound } = await import('../score');
    const reg = Int8Array.from([0, 0, 0, 0, 0]);
    const ratio = Float64Array.from([1.2, 0.95, 1.2, 0.95, 0.95]);
    const out = applyRebound(reg, ratio, { enabled: true, peak: 1.1, lookback: 20, normal: 1.0, hold: 5, toRegime: 2 });
    expect(Array.from(out)).toEqual([0, 2, 0, 2, 2]);
  });
});
