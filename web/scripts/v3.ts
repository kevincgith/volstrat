/**
 * VolStrat v3 evaluation (docs/PREREG-v3.md).
 *
 *   npm run v3 -- us        US design check, criteria A-C (1993-2006 and 2007-latest)
 *   npm run v3 -- europe    European holdout, criteria D-F (run once, 2026-10-23)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pairedBootstrap } from '../src/engine/bootstrap';
import { assemble } from '../src/engine/data';
import type { AssetSeries } from '../src/engine/assets';
import { usV3Market, V3_PARAMS, v3Metrics, v3Run, type V3Market, type V3Params } from '../src/engine/v3';

const SITE = resolve(process.cwd(), '../data/site');
const load = (f: string) => JSON.parse(readFileSync(resolve(SITE, f), 'utf8'));
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

function idx(m: V3Market, iso: string, last = false): number {
  if (!last) return m.dates.findIndex((d) => d >= iso);
  let i = m.dates.length - 1;
  while (i > 0 && m.dates[i]! > iso) i--;
  return i;
}

export function report(m: V3Market, eras: [string, string, string][], p: V3Params = V3_PARAMS) {
  const r = v3Run(m, p, eras[0]![1]);
  console.log(`run ${m.dates[r.start]} .. ${m.dates[r.end]}; params ${JSON.stringify(p)}`);
  const rows: { era: string; s: ReturnType<typeof v3Metrics>['strategy']; b: ReturnType<typeof v3Metrics>['benchmark'] }[] = [];
  for (const [name, a, b] of eras) {
    const ia = Math.max(r.start, idx(m, a));
    const ib = b ? idx(m, b, true) : r.end;
    const { strategy: s, benchmark: bm } = v3Metrics(m, r, ia, ib);
    rows.push({ era: name, s, b: bm });
  }
  console.log('era                 |  v3: CAGR    vol   Sharpe  maxDD   turn  costs | 60/40: CAGR    vol  Sharpe  maxDD | Sharpe diff');
  for (const { era, s, b } of rows) {
    console.log(
      `${era.padEnd(20)}| ${pct(s.cagr).padStart(7)} ${pct(s.vol).padStart(6)} ${s.sharpe.toFixed(2).padStart(6)} ${pct(s.maxDrawdown).padStart(7)} ${s.turnover.toFixed(2).padStart(5)} ${pct(s.costDrag, 2).padStart(6)} | ${pct(b.cagr).padStart(8)} ${pct(b.vol).padStart(6)} ${b.sharpe.toFixed(2).padStart(6)} ${pct(b.maxDrawdown).padStart(7)} | ${(s.sharpe - b.sharpe).toFixed(2).padStart(6)}`,
    );
  }
  const s0 = r.start;
  const e0 = r.end;
  const sl = (x: Float64Array) => x.slice(s0 + 1, e0 + 1);
  const bs = pairedBootstrap(sl(r.strategy.returns), sl(r.benchmark.returns), sl(m.cash.returns), { n: 1000, blockLen: 21, seed: 12345 });
  console.log(
    `bootstrap (whole run, 21-day blocks, 1000 draws): Sharpe diff p5 ${bs.sharpeDiff.p5.toFixed(3)} p50 ${bs.sharpeDiff.p50.toFixed(3)} p95 ${bs.sharpeDiff.p95.toFixed(3)}; better in ${pct(bs.sharpeDiff.probPositive, 0)}`,
  );
  // by year
  const years: string[] = [];
  for (let y = Number(m.dates[s0]!.slice(0, 4)); y <= Number(m.dates[e0]!.slice(0, 4)); y++) {
    const a = Math.max(s0, idx(m, `${y}-01-01`) - 1);
    const b = idx(m, `${y}-12-31`, true);
    if (b <= a) continue;
    const g = (nav: Float64Array) => nav[b]! / nav[a]! - 1;
    let eq = 0;
    let k = 0;
    for (let t = a + 1; t <= b; t++) {
      const w = r.strategy.weights.EQ![t]!;
      if (Number.isFinite(w)) {
        eq += w;
        k++;
      }
    }
    years.push(`${y} ${pct(g(r.strategy.nav)).padStart(7)} ${pct(g(r.benchmark.nav)).padStart(7)} eq ${(eq / Math.max(1, k)).toFixed(2)}`);
  }
  console.log('year      v3   60/40  avg equity');
  for (const l of years) console.log(l);
  return { rows, bootstrap: bs };
}

const mode = process.argv[2] ?? 'us';
if (mode === 'us') {
  const d = assemble(load('signals.json'), load('assets.json'), load('meta.json'));
  const out = report(usV3Market(d), [
    ['US 1993-2006', '1993-01-04', '2006-12-29'],
    ['US 2007-latest', '2007-01-03', ''],
    ['US 1993-latest', '1993-01-04', ''],
  ]);
  const [e1, e2] = out.rows;
  const A = e1!.s.sharpe > e1!.b.sharpe && e2!.s.sharpe > e2!.b.sharpe;
  const B = e1!.s.maxDrawdown >= e1!.b.maxDrawdown && e2!.s.maxDrawdown >= e2!.b.maxDrawdown;
  const C = out.bootstrap.sharpeDiff.probPositive >= 0.9;
  console.log(`\ncriteria: A (Sharpe > 60/40 in both eras) ${A ? 'PASS' : 'FAIL'}; B (max DD no deeper in both) ${B ? 'PASS' : 'FAIL'}; C (bootstrap >= 90%) ${C ? 'PASS' : 'FAIL'}`);
} else if (mode === 'europe') {
  const j = JSON.parse(readFileSync(resolve(process.cwd(), '../data/europe/europe.json'), 'utf8')) as {
    dates: string[];
    series: Record<string, (number | null)[]>;
    assets: Record<string, (number | null)[]>;
  };
  const f = (x: (number | null)[]) => Float64Array.from(x, (v) => (v === null ? NaN : v));
  const asset = (key: string): AssetSeries => {
    const tr = f(j.assets[key]!);
    const r = tr.map((v, t) => (t > 0 && tr[t - 1]! > 0 && Number.isFinite(v) ? v / tr[t - 1]! - 1 : NaN));
    let first = r.findIndex(Number.isFinite);
    if (first < 0) first = r.length;
    return { key, label: key, returns: r, synthetic: new Uint8Array(r.length), first };
  };
  const v1 = f(j.series.V6I1!);
  const v3m = f(j.series.V6I3!);
  const base: V3Market = {
    dates: j.dates,
    index: f(j.series.SX5E!),
    vol: f(j.series.V2TX!),
    curve: v1.map((v, t) => (v3m[t]! > 0 ? v / v3m[t]! : NaN)),
    equity: asset('EQ_SX5E'),
    bond: asset('BOND_EU7'),
    cash: asset('CASH_EUR'),
  };
  const eras: [string, string, string][] = [
    ['Europe 2000-latest', '2000-01-01', ''],
    ['Europe 2000-2006', '2000-01-01', '2006-12-29'],
    ['Europe 2007-latest', '2007-01-02', ''],
  ];
  console.log('== Euro Stoxx 50 (+3% est. dividends), 7y euro govt bond, VSTOXX signals');
  const sx = report(base, eras);
  // DAX check: identical signals (Euro Stoxx 50 / VSTOXX); the DAX replaces the equity held and in the benchmark
  console.log('\n== Check: DAX as the equity sleeve, same signals');
  const dx = report({ ...base, equity: asset('EQ_DAX') }, eras);
  const verdictD = (o: typeof sx) => o.rows[0]!.s.sharpe > o.rows[0]!.b.sharpe && o.bootstrap.sharpeDiff.probPositive >= 0.9;
  const D = verdictD(sx);
  const E = sx.rows[0]!.s.maxDrawdown >= sx.rows[0]!.b.maxDrawdown;
  const F = verdictD(dx) === D;
  const pos = sx.rows[0]!.s.sharpe > sx.rows[0]!.b.sharpe;
  const pb = sx.bootstrap.sharpeDiff.probPositive;
  console.log(`\ncriteria: D (Sharpe > 60/40 and bootstrap >= 90%) ${D ? 'PASS' : 'FAIL'} (bootstrap ${pct(pb, 0)}); E (max DD no deeper) ${E ? 'PASS' : 'FAIL'}; F (DAX check agrees with D) ${F ? 'PASS' : 'FAIL'}`);
  const verdict = D && E && F ? 'PROVEN' : pos && pb >= 0.75 ? 'SUPPORTED' : 'NOT SUPPORTED';
  console.log(`verdict (US A-C passed on 2026-10-23): ${verdict}`);
} else {
  console.error(`unknown mode ${mode}`);
  process.exit(1);
}
