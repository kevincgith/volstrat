import { describe, expect, it } from 'vitest';
import { isPeriodEnd, simulate } from '../backtest';
import type { AssetSeries } from '../assets';
import type { Weights } from '../allocation';
import { bdays } from './fixture';

const dates = bdays('2024-01-01', 12);
const n = dates.length;
const asset = (key: string, r: number): AssetSeries => ({
  key,
  label: key,
  returns: new Float64Array(n).fill(r),
  synthetic: new Uint8Array(n),
  first: 0,
});
const assets = { SPX: asset('SPX', 0.01), BIL: asset('BIL', 0) };

describe('simulate timing', () => {
  // decide to switch from BIL to SPX at the close of day 3
  const targets: (Weights | null)[] = dates.map((_, i) => (i < 3 ? { BIL: 1 } : { SPX: 1 }));

  it('trades at the close of d + lag and earns from the following day', () => {
    for (const lag of [1, 2]) {
      const res = simulate(dates, assets, targets, { lag, rebalance: 'daily', band: 0, costBps: 0 }, 0, n - 1);
      const tradeDay = 3 + lag;
      for (let t = res.start + 1; t <= tradeDay; t++) expect(res.returns[t]).toBe(0);
      expect(res.returns[tradeDay + 1]).toBeCloseTo(0.01, 12);
      expect(res.weights.SPX![tradeDay]).toBe(1);
      expect(res.weights.SPX![tradeDay - 1]).toBeNaN();
    }
  });

  it('charges costs per side on notional traded', () => {
    const res = simulate(dates, assets, targets, { lag: 1, rebalance: 'regime', band: 0, costBps: 10 }, 0, n - 1);
    expect(res.costs[4]).toBeCloseTo(0.002, 12); // sell 100% + buy 100% at 10bp each
    expect(res.turnover[4]).toBeCloseTo(1, 12);
    expect(res.trades).toBe(1);
  });

  it('lets weights drift between monthly rebalances', () => {
    const mix: (Weights | null)[] = dates.map(() => ({ SPX: 0.5, BIL: 0.5 }));
    const res = simulate(dates, assets, mix, { lag: 1, rebalance: 'monthly', band: 0, costBps: 0 }, 1, n - 1);
    expect(res.weights.SPX![res.start + 1]).toBeGreaterThan(0.5);
  });
});

describe('isPeriodEnd', () => {
  it('detects week and month ends', () => {
    const d = ['2024-01-30', '2024-01-31', '2024-02-01', '2024-02-02', '2024-02-05'];
    expect(isPeriodEnd(d, 1, 'month')).toBe(true);
    expect(isPeriodEnd(d, 2, 'month')).toBe(false);
    expect(isPeriodEnd(d, 3, 'week')).toBe(true); // Friday
    expect(isPeriodEnd(d, 2, 'week')).toBe(false);
  });
});
