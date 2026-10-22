/** Deterministic synthetic market data covering every engine input. */
import type { MarketData } from '../data';
import { COMPONENTS } from '../components';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function bdays(start: string, n: number): string[] {
  const out: string[] = [];
  const d = new Date(start + 'T00:00:00Z');
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function walk(r: () => number, n: number, start: number, vol: number, drift = 0): Float64Array {
  const x = new Float64Array(n);
  let v = start;
  for (let i = 0; i < n; i++) {
    v *= Math.exp(drift + vol * (r() - 0.5) * 2);
    x[i] = v;
  }
  return x;
}

export function makeFixture(n = 1500, seed = 7): MarketData {
  const r = rng(seed);
  const dates = bdays('2010-01-04', n);
  const series: Record<string, Float64Array> = {};
  const keys = new Set(COMPONENTS.flatMap((c) => c.inputs).filter((k) => !k.startsWith('asset:')));
  for (const k of keys) series[k] = walk(r, n, k === 'SPX' ? 1000 : 20, 0.02);
  series.Y3M = new Float64Array(n).fill(2);
  const seg = (src: string) => [{ from: dates[0]!, to: dates[n - 1]!, source: src, label: src, synthetic: false }];
  const asset = (label: string, vol: number, group: 'risk' | 'defensive' | 'proxy' = 'risk') => ({
    label,
    group,
    expense_ratio: 0,
    segments: seg(label),
    tr: walk(r, n, 1, vol, 0.0002),
  });
  const assets = {
    SPX: asset('SPX', 0.012),
    SSO: asset('SSO', 0.024),
    UPRO: asset('UPRO', 0.036),
    WORLD: asset('WORLD', 0.011),
    IEF: asset('IEF', 0.004, 'defensive'),
    TLT: asset('TLT', 0.008, 'defensive'),
    AGG: asset('AGG', 0.003, 'defensive'),
    SHY: asset('SHY', 0.001, 'defensive'),
    BIL: asset('BIL', 0.0001, 'defensive'),
    GLD: asset('GLD', 0.01, 'defensive'),
    XLU: asset('XLU', 0.01, 'defensive'),
    CASH: asset('CASH', 0.00005, 'proxy'),
    HYG: asset('HYG', 0.005, 'proxy'),
    LQD: asset('LQD', 0.004, 'proxy'),
  };
  return {
    dates,
    series,
    seriesMeta: {},
    assets,
    meta: { generated_at: '', last_date: dates[n - 1]!, sources: {} },
  };
}

/** Copy of `d` with every input value strictly after index `t` replaced by noise. */
export function perturbAfter(d: MarketData, t: number, opts: { signals: boolean; assets: boolean }, seed = 99): MarketData {
  const r = rng(seed);
  const series = Object.fromEntries(
    Object.entries(d.series).map(([k, v]) => {
      const c = Float64Array.from(v);
      if (opts.signals) for (let i = t + 1; i < c.length; i++) c[i] = c[i]! * (0.3 + 2 * r());
      return [k, c];
    }),
  );
  const assets = Object.fromEntries(
    Object.entries(d.assets).map(([k, a]) => {
      const tr = Float64Array.from(a.tr);
      if (opts.assets) for (let i = t + 1; i < tr.length; i++) tr[i] = tr[i - 1]! * (0.9 + 0.2 * r());
      return [k, { ...a, tr }];
    }),
  );
  return { ...d, series, assets };
}
