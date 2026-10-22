import { describe, expect, it } from 'vitest';
import type { AssetKey } from '../assets';
import { DEFAULT_PARAMS, merge } from '../params';
import { optimiseAllocation, optimiseWeights, projectCappedSimplex, solveRegime, walkForwardWeights, type AllocOptions } from '../optimise';
import { makeFixture, perturbAfter } from './fixture';

const OPT: AllocOptions = {
  universe: ['SPX', 'IEF', 'GLD', 'BIL'] as AssetKey[],
  objective: 'maxSharpe',
  maxWeight: 0.6,
  meanShrink: 0.5,
  covShrink: 0.1,
  volCap: 0.12,
  minObs: 50,
};

describe('portfolio maths', () => {
  it('projects onto the capped simplex', () => {
    const w = projectCappedSimplex([3, 1, -2, 0.5], 0.6);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
    expect(Math.max(...w)).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(Math.min(...w)).toBeGreaterThanOrEqual(0);
  });

  it('max Sharpe prefers the high-Sharpe asset up to the cap; min variance the low-vol one', () => {
    const m = { n: 500, mu: [0.1, 0.01], sigma: [[0.04, 0], [0, 0.04]] };
    const opt = { ...OPT, universe: ['SPX', 'GLD'] as AssetKey[], maxWeight: 0.8, meanShrink: 0 };
    const ms = solveRegime(m, opt, {});
    expect(ms.weights.SPX).toBeCloseTo(0.8, 2);
    const mv = solveRegime({ n: 500, mu: [0.1, 0.01], sigma: [[0.09, 0], [0, 0.01]] }, { ...opt, objective: 'minVariance', maxWeight: 1 }, {});
    expect(mv.weights.GLD!).toBeGreaterThan(0.85);
  });

  it('utility trades return against variance with risk aversion', () => {
    const m = { n: 500, mu: [0.08, 0.0], sigma: [[0.04, 0], [0, 0.0001]] };
    const opt = { ...OPT, universe: ['SPX', 'BIL'] as AssetKey[], objective: 'utility' as const, maxWeight: 1, meanShrink: 0 };
    // unconstrained optimum for SPX ~ mu / (gamma sigma^2) = 0.08 / (2 * 0.04) = 1 -> capped; gamma 4 -> 0.5
    expect(solveRegime(m, { ...opt, riskAversion: 4 }, {}).weights.SPX).toBeCloseTo(0.5, 1);
    expect(solveRegime(m, { ...opt, riskAversion: 1 }, {}).weights.SPX).toBeCloseTo(1, 1);
  });

  it('keeps the current portfolio when a regime has too few observations', () => {
    const r = solveRegime({ n: 10, mu: [0, 0, 0, 0], sigma: [] }, OPT, { BIL: 1 });
    expect(r.kept).toBe(true);
    expect(r.weights).toEqual({ BIL: 1 });
  });
});

describe('optimisers are free of look-ahead', () => {
  const p = merge(DEFAULT_PARAMS, { period: { start: '2010-01-01' }, score: { window: 252, minPeriods: 126 } });
  const d = makeFixture(1500);

  it('walk-forward allocation NAV to T ignores data after T', () => {
    const a = optimiseAllocation(d, p, OPT, { minTrainYears: 1, refitYears: 0.5 });
    expect(a.oos).not.toBeNull();
    const T = 1200;
    const b = optimiseAllocation(perturbAfter(d, T, { signals: true, assets: true }), p, OPT, { minTrainYears: 1, refitYears: 0.5 });
    const k = d.dates.indexOf(a.oos!.from);
    for (let t = 0; t <= T - k; t++) expect(b.oos!.navWalkForward[t]).toBe(a.oos!.navWalkForward[t]);
    a.oos!.refits.filter((r) => r.date <= d.dates[T]!).forEach((r, i) => expect(b.oos!.refits[i]!.portfolios).toEqual(r.portfolios));
  });

  it('signal-weight optimisation uses the training period only', () => {
    const trainEnd = d.dates[1100]!;
    const opts = { objective: 'sharpe' as const, trainEnd, values: [0, 1, 2], maxPasses: 1 };
    const a = optimiseWeights(d, p, opts);
    const b = optimiseWeights(perturbAfter(d, 1101, { signals: true, assets: true }), p, opts);
    expect(b.optimised).toEqual(a.optimised);
    expect(b.train.optimised.sharpe).toBe(a.train.optimised.sharpe);
  });

  it('walk-forward weight re-optimisation NAV to T ignores data after T', () => {
    const opts = { objective: 'sharpe' as const, firstTest: d.dates[700]!, refitYears: 1, values: [0, 1], maxPasses: 1 };
    const a = walkForwardWeights(d, p, opts)!;
    expect(a.periods.length).toBeGreaterThan(1);
    const T = 1150;
    const b = walkForwardWeights(perturbAfter(d, T, { signals: true, assets: true }), p, opts)!;
    const k = d.dates.indexOf(a.dates[0]!);
    for (let t = 0; t <= T - k; t++) expect(b.nav.walkForward[t]).toBe(a.nav.walkForward[t]);
    a.periods.filter((x) => x.from <= d.dates[T]!).forEach((x, i) => expect(b.periods[i]!.weights).toEqual(x.weights));
  });
});
