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

describe('recovery re-entry', () => {
  const P = { enabled: true, offPeak: 0.8, peakDays: 3, normal: 1.0, maDays: 2, lowDays: 2, toRegime: 2 };
  it('enters when stress recedes, the curve is normal and price confirms; exits on re-inversion', async () => {
    const { applyReentry } = await import('../score');
    const reg = Int8Array.from([1, 0, 0, 0, 0, 0, 0, 1]);
    const vix = Float64Array.from([20, 40, 35, 30, 28, 28, 30, 30]);
    const v3m = Float64Array.from([22, 32, 33, 32, 31, 31, 29, 31]);
    const spx = Float64Array.from([100, 90, 92, 95, 97, 98, 99, 100]);
    // t=3: 30 <= 0.8*40=32, ratio 0.94, spx 95 > sma(92,95)=93.5 -> enter
    // t=6: ratio 30/29 >= 1 -> exit; t=7: peak(28,30,30)=30, 30 > 24 -> no re-entry
    expect(Array.from(applyReentry(reg, vix, v3m, spx, P))).toEqual([1, 0, 0, 2, 2, 2, 0, 1]);
  });
  it('exits on a break below the recent low and needs all conditions again', async () => {
    const { applyReentry } = await import('../score');
    const reg = Int8Array.from([0, 0, 0, 0, 0, 0]);
    const vix = Float64Array.from([40, 30, 30, 30, 30, 30]);
    const v3m = Float64Array.from([35, 32, 32, 32, 32, 32]);
    const spx = Float64Array.from([100, 102, 104, 103, 99, 103]);
    // t=1 enter (30<=32, 0.94, 102>101); t=4: 99 < min(104,103) -> exit; t=5: peak(30,30,30) -> 30 > 24, stays out
    expect(Array.from(applyReentry(reg, vix, v3m, spx, P))).toEqual([0, 2, 2, 2, 0, 0]);
  });
  it('never lowers a regime and lapses once the signal itself recovers', async () => {
    const { applyReentry } = await import('../score');
    const reg = Int8Array.from([0, 3, 0]);
    const out = applyReentry(reg, Float64Array.from([40, 30, 30]), Float64Array.from([35, 32, 32]), Float64Array.from([100, 102, 99]), P);
    expect(out[1]).toBe(3);
  });
});
