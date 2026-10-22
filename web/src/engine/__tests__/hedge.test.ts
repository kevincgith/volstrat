import { describe, expect, it } from 'vitest';
import { swapDuration } from '../allocation';
import { DEFAULT_PARAMS, merge } from '../params';
import { rollingCorrelation, strategyTargets } from '../run';

describe('adaptive hedge', () => {
  it('swaps duration assets into the replacement and merges weights', () => {
    expect(swapDuration({ IEF: 0.5, GLD: 0.25, BIL: 0.25 }, 'BIL')).toEqual({ BIL: 0.75, GLD: 0.25 });
    const w = { SPX: 1 };
    expect(swapDuration(w, 'BIL')).toBe(w);
  });

  it('rolling correlation is causal and correct', () => {
    const a = Float64Array.from({ length: 100 }, (_, i) => Math.sin(i));
    const b = Float64Array.from(a, (x) => 2 * x + 1);
    const c = rollingCorrelation(a, b, 20);
    expect(c[18]).toBeNaN();
    expect(c[19]).toBeCloseTo(1, 10);
    const a2 = Float64Array.from(a);
    for (let i = 60; i < 100; i++) a2[i] = -a2[i]!;
    const c2 = rollingCorrelation(a2, b, 20);
    for (let i = 0; i < 60; i++) expect(Number.isNaN(c2[i]!) ? NaN : c2[i]).toEqual(Number.isNaN(c[i]!) ? NaN : c[i]);
  });

  it('applies the swap only on days the correlation exceeds the threshold', () => {
    const p = merge(DEFAULT_PARAMS, { allocation: { adaptiveHedge: { enabled: true, threshold: 0 } } });
    const score = Float64Array.from([30, 30]);
    const reg = Int8Array.from([1, 1]); // Risk-Off: IEF 50 / GLD 25 / XLU 25
    const t = strategyTargets(score, reg, p, Float64Array.from([-0.3, 0.3]));
    expect(t[0]).toEqual({ IEF: 0.5, GLD: 0.25, XLU: 0.25 });
    expect(t[1]).toEqual({ BIL: 0.5, GLD: 0.25, XLU: 0.25 });
  });
});
