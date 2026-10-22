/** Runs the engine on the real pipeline output in data/site (skipped if absent). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAssets } from '../assets';
import { assemble } from '../data';
import { DEFAULT_PARAMS, PRESETS, presetParams } from '../params';
import { run } from '../run';

const dir = resolve(__dirname, '../../../../data/site');
const have = existsSync(resolve(dir, 'signals.json'));
const load = (f: string) => JSON.parse(readFileSync(resolve(dir, f), 'utf8'));

describe.skipIf(!have)('real data', () => {
  const data = have ? assemble(load('signals.json'), load('assets.json'), load('meta.json')) : null!;

  it.each(PRESETS.map((p) => p.id))('preset %s runs cleanly', (id) => {
    const r = run(data, presetParams(id));
    expect(r.strategy.result.missingReturnDays).toBe(0);
    expect(r.start).toBeGreaterThan(0);
    const m = r.strategy.metrics;
    expect(Number.isFinite(m.cagr) && Math.abs(m.cagr) < 0.6).toBe(true);
    expect(m.maxDrawdown).toBeLessThan(0);
    for (const b of r.benchmarks) expect(b.result.missingReturnDays).toBe(0);
  });

  it('default backtest starts in 2007 with the full component set', () => {
    const r = run(data, DEFAULT_PARAMS);
    expect(data.dates[r.start]!.slice(0, 4)).toBe('2007');
  });

  it('synthetic 2x tracks the real SSO closely where both exist', () => {
    const real = buildAssets(data, { financingSpread: 0.0075, alwaysSynthetic: false }).SSO!;
    const syn = buildAssets(data, { financingSpread: 0.0075, alwaysSynthetic: true }).SSO!;
    const a: number[] = [];
    const b: number[] = [];
    for (let t = real.first + 1; t < data.dates.length; t++) {
      if (Number.isFinite(real.returns[t]!) && Number.isFinite(syn.returns[t]!)) {
        a.push(real.returns[t]!);
        b.push(syn.returns[t]!);
      }
    }
    const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
    const ma = mean(a);
    const mb = mean(b);
    let cov = 0;
    let va = 0;
    let vb = 0;
    for (let i = 0; i < a.length; i++) {
      cov += (a[i]! - ma) * (b[i]! - mb);
      va += (a[i]! - ma) ** 2;
      vb += (b[i]! - mb) ** 2;
    }
    const corr = cov / Math.sqrt(va * vb);
    const annualGap = (mb - ma) * 252;
    console.info(`SSO synthetic vs real: corr=${corr.toFixed(4)}, annual return gap=${(annualGap * 100).toFixed(2)}%`);
    expect(corr).toBeGreaterThan(0.99);
    expect(Math.abs(annualGap)).toBeLessThan(0.015);
  });
});

describe.skipIf(!have)('component correlations on real data', () => {
  it('finds the documented near-duplicates and is symmetric', async () => {
    const { componentCorrelations } = await import('../diagnostics');
    const data = assemble(load('signals.json'), load('assets.json'), load('meta.json'));
    const m = componentCorrelations(data, DEFAULT_PARAMS.score);
    const at = (a: string, b: string) => m.corr[m.ids.indexOf(a)]![m.ids.indexOf(b)]!;
    expect(m.ids.length).toBeGreaterThanOrEqual(20);
    expect(at('vix', 'vix')).toBeCloseTo(1, 10);
    expect(at('vix_term', 'vts_vx30_roll')).toBe(at('vts_vx30_roll', 'vix_term'));
    expect(at('vx_slope', 'vts_adj_m1m2')).toBeGreaterThan(0.9); // METHODOLOGY 14.3: 0.97
    expect(at('vix', 'vx30_level')).toBeGreaterThan(0.9); // 0.96
    expect(at('vrp', 'vts_traders_vrp')).toBeLessThan(0.6); // 0.44
  });
});
