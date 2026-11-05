import { describe, expect, it } from 'vitest';
import { BASE_PARAMS, DEFAULT_PARAMS, merge, presetParams, V5_PATCH } from '../params';
import { riskBudgetTargets, run } from '../run';
import { makeFixture } from './fixture';

describe('v5 risk budget', () => {
  const d = makeFixture();
  const p = merge(merge(BASE_PARAMS, V5_PATCH), { period: { start: '2010-01-01' } });

  it('is off in the defaults and the frozen-record base', () => {
    expect(BASE_PARAMS.allocation.mode).toBe('regime');
    expect(DEFAULT_PARAMS.allocation.mode).toBe('regime');
    expect(presetParams('riskbudget').allocation.mode).toBe('riskBudget');
  });

  it('sizes equity as targetVol / realised vol, capped, halved below trend', () => {
    const r = run(d, p);
    const eq = r.assets.SPX!.returns;
    const rb = p.allocation.riskBudget!;
    const tg = riskBudgetTargets(r.assets, rb, d.dates.length);
    let idx = 1;
    const lvl: number[] = [];
    for (let t = 0; t < eq.length; t++) {
      if (Number.isFinite(eq[t]!)) idx *= 1 + eq[t]!;
      lvl.push(idx);
    }
    let checked = 0;
    for (let t = 400; t < 1400; t += 97) {
      const w = tg[t];
      if (!w) continue;
      const win = Array.from(eq.slice(t - 20, t + 1));
      const m = win.reduce((a, b) => a + b, 0) / 21;
      const sd = Math.sqrt(win.reduce((a, b) => a + (b - m) ** 2, 0) / 20) * Math.sqrt(252);
      const sma = lvl.slice(t - 199, t + 1).reduce((a, b) => a + b, 0) / 200;
      const expected = Math.min(1, 0.12 / sd) * (lvl[t]! < sma ? 0.5 : 1);
      expect(w.SPX).toBeCloseTo(expected, 9);
      const rest = Object.entries(w).filter(([k]) => k !== 'SPX');
      if (expected < 1) expect(rest.length).toBe(1);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('runs end to end without leverage', () => {
    const r = run(d, p);
    expect(r.strategy.metrics.years).toBeGreaterThan(1);
    for (const w of r.targets) if (w) expect(w.SPX!).toBeLessThanOrEqual(1 + 1e-12);
  });

  it('holds exposure above 100% through the leveraged ETF, never as unfunded equity', () => {
    const q = merge(p, { allocation: { riskBudget: { maxEquity: 1.5, targetVol: 0.5 } } });
    const r = run(d, q);
    let lev = 0;
    for (const w of r.targets) {
      if (!w) continue;
      const tot = Object.values(w).reduce((a, b) => a + (b ?? 0), 0);
      expect(tot).toBeCloseTo(1, 9);
      expect(w.SPX ?? 0).toBeLessThanOrEqual(1 + 1e-12);
      if ((w.SSO ?? 0) > 0) lev++;
    }
    expect(lev).toBeGreaterThan(0);
  });

  it('recession gate: the brake is skipped only while the unemployment gap is known and not positive', () => {
    const r = run(d, p);
    const rb = p.allocation.riskBudget!;
    const n = d.dates.length;
    const gated = { ...rb, recessionGate: { enabled: true } };
    const noBrake = riskBudgetTargets(r.assets, { ...rb, brake: 1 }, n);
    const withBrake = riskBudgetTargets(r.assets, rb, n);
    // gap <= 0 everywhere: same as no brake; gap > 0 everywhere or missing: same as v5
    expect(riskBudgetTargets(r.assets, gated, n, new Float64Array(n).fill(-0.1))).toEqual(noBrake);
    expect(riskBudgetTargets(r.assets, gated, n, new Float64Array(n).fill(0.1))).toEqual(withBrake);
    expect(riskBudgetTargets(r.assets, gated, n, new Float64Array(n).fill(NaN))).toEqual(withBrake);
    expect(riskBudgetTargets(r.assets, gated, n)).toEqual(withBrake);
    // the gate is off in the defaults, so frozen records are unchanged
    expect(BASE_PARAMS.allocation.riskBudget!.recessionGate?.enabled).toBe(false);
  });
});

describe('v13 recession gate on the fixture', () => {
  it('changes the allocation when the gap turns negative below trend', () => {
    const d = makeFixture();
    const base = merge(merge(BASE_PARAMS, V5_PATCH), { period: { start: '2010-01-01' } });
    const gated = merge(base, { allocation: { riskBudget: { recessionGate: { enabled: true } } } });
    const a = run(d, base).targets;
    const b = run(d, gated).targets;
    const differ = a.filter((w, i) => JSON.stringify(w) !== JSON.stringify(b[i])).length;
    expect(differ).toBeGreaterThan(0);
  });
});
