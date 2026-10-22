/**
 * Look-ahead bias tests. If any output for day <= T changes when inputs
 * strictly after T are altered, the engine is using future information.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, merge, type Params } from '../params';
import { run } from '../run';
import { makeFixture, perturbAfter } from './fixture';

const base = makeFixture();
const T = 1100;

const configs: [string, Params][] = [
  ['default (regime, percentile)', merge(DEFAULT_PARAMS, { period: { start: '2010-01-01' } })],
  [
    'continuous, z-score, expanding, daily, lag 2',
    merge(DEFAULT_PARAMS, {
      period: { start: '2010-01-01' },
      score: { method: 'zscore', window: 0, smoothing: 10 },
      allocation: { mode: 'continuous' },
      backtest: { rebalance: 'daily', lag: 2, band: 0 },
    }),
  ],
  [
    'adaptive stock-bond hedge on',
    merge(DEFAULT_PARAMS, {
      period: { start: '2010-01-01' },
      allocation: { adaptiveHedge: { enabled: true, lookback: 63, threshold: -0.2, replacement: 'BIL' } },
    }),
  ],
  [
    'asymmetric buffers, min hold, per-asset costs',
    merge(DEFAULT_PARAMS, {
      period: { start: '2010-01-01' },
      regime: { bufferUp: 0, bufferDown: 5, minHoldDays: 10, fastDerisk: false },
      backtest: { assetCostBps: { SSO: 20, GLD: 8 } },
    }),
  ],
  [
    'rebound overlay on',
    merge(DEFAULT_PARAMS, { period: { start: '2010-01-01' }, regime: { rebound: { enabled: true, peak: 1.05 } } }),
  ],
];

function same(a: ArrayLike<number>, b: ArrayLike<number>, upto: number) {
  for (let i = 0; i <= upto; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (Number.isNaN(x) && Number.isNaN(y)) continue;
    expect(y, `index ${i}`).toBe(x);
  }
}

describe.each(configs)('no look-ahead: %s', (_, p) => {
  const ref = run(base, p);

  it('signal and allocation decisions to T ignore inputs after T', () => {
    const alt = run(perturbAfter(base, T, { signals: true, assets: true }), p);
    same(ref.score.composite, alt.score.composite, T);
    same(ref.score.score, alt.score.score, T);
    same(ref.regimes, alt.regimes, T);
    for (let i = 0; i <= T; i++) expect(alt.targets[i]).toEqual(ref.targets[i]);
  });

  it('NAV to T is unaffected by any data after T', () => {
    const alt = run(perturbAfter(base, T, { signals: true, assets: true }), p);
    expect(alt.start).toBe(ref.start);
    same(ref.strategy.result.nav, alt.strategy.result.nav, T);
    for (const [i, b] of ref.benchmarks.entries()) same(b.result.nav, alt.benchmarks[i]!.result.nav, T);
  });

  it('positions held through T + lag depend only on signals up to T', () => {
    const lag = p.backtest.lag;
    const alt = run(perturbAfter(base, T, { signals: true, assets: false }), p);
    for (const k of Object.keys(ref.strategy.result.weights)) {
      same(ref.strategy.result.weights[k]!, alt.strategy.result.weights[k]!, T + lag);
    }
    same(ref.strategy.result.nav, alt.strategy.result.nav, T + lag);
  });
});
