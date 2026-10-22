import { describe, expect, it } from 'vitest';
import { buildAssets } from '../assets';
import { DEFAULT_PARAMS, merge } from '../params';
import { applyAxis, expectedMaxSharpe, runGrid, walkForward } from '../robustness';
import { run } from '../run';
import { makeFixture, perturbAfter } from './fixture';

const p = merge(DEFAULT_PARAMS, { period: { start: '2010-01-01' }, score: { window: 252, minPeriods: 126 } });
const X = { param: 'smoothing' as const, values: [1, 10] };
const Y = { param: 'hysteresis' as const, values: [0, 5] };

function wf(d: ReturnType<typeof makeFixture>) {
  const grid = runGrid(d, p, X, Y);
  const base = run(d, p);
  const a = buildAssets(d, p.assets);
  return walkForward(d, grid, base.strategy.result.returns, a.CASH!.returns, base.benchmarks[0]!.result.nav, {
    trainYears: 1,
    testYears: 0.5,
    objective: 'sharpe',
    costBps: 5,
  })!;
}

describe('robustness', () => {
  it('applies axis values', () => {
    expect(applyAxis(p, 'thresholdShift', 5).regime.thresholds).toEqual([25, 45, 65, 85]);
    expect(applyAxis(p, 'thresholdSpread', 0.5).regime.thresholds).toEqual([35, 45, 55, 65]);
    expect(applyAxis(p, 'smoothing', 9).score.smoothing).toBe(9);
  });

  it('walk-forward selection and NAV ignore data after each decision point', () => {
    const d = makeFixture(1500);
    const a = wf(d);
    expect(a.periods.length).toBeGreaterThan(1);
    const T = Math.floor((a.start + a.end) / 2);
    const b = wf(perturbAfter(d, T, { signals: true, assets: true }));
    for (let t = a.start; t <= T; t++) expect(b.nav[t]).toBe(a.nav[t]);
    const tDate = d.dates[T]!;
    a.periods.filter((x) => x.testStart <= tDate).forEach((x, i) => expect(b.periods[i]!.chosen).toBe(x.chosen));
  });

  it('expected max Sharpe grows with the number of trials and shrinks with time', () => {
    expect(expectedMaxSharpe(1, 10)).toBe(0);
    expect(expectedMaxSharpe(100, 10)).toBeGreaterThan(expectedMaxSharpe(10, 10));
    expect(expectedMaxSharpe(100, 40)).toBeLessThan(expectedMaxSharpe(100, 10));
  });
});
