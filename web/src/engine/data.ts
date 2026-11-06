/** Site data model (data/site/*.json) and loaders. Missing values are NaN. */

export interface Segment {
  from: string;
  to: string;
  source: string;
  label: string;
  synthetic: boolean;
}

export interface SeriesMeta {
  label: string;
  unit: string;
  source: string;
  lag_bdays: number;
  lag_days: number;
  first: string | null;
  last: string | null;
}

export interface AssetData {
  label: string;
  group: 'risk' | 'defensive' | 'proxy';
  expense_ratio: number;
  segments: Segment[];
  tr: Float64Array;
}

export interface SourceStatus {
  name: string;
  required: boolean;
  ok: boolean;
  last_date: string | null;
  rows: number;
  message: string;
  warnings: string[];
  checked_at?: string;
  /** Past-week values that changed between the stored copy and the latest download. */
  revisions?: { date: string; column: string; old: number; new: number | null }[];
  reconciled_days?: number;
}

export interface MarketData {
  dates: string[];
  series: Record<string, Float64Array>;
  seriesMeta: Record<string, SeriesMeta>;
  assets: Record<string, AssetData>;
  meta: {
    generated_at: string;
    last_date: string;
    sources: Record<string, SourceStatus>;
    checks?: { name: string; ok: boolean; detail: string }[];
    /** Latest date accepted as final end-of-day data at fetch time. */
    eod_cutoff?: string;
    /** Latest published date: every price exists, and every score input exists or is past its deadline. */
    complete_through?: string;
    /** Inputs not yet published for the latest end-of-day date, with their last date. */
    pending?: Record<string, string>;
    /** Score inputs still missing at the noon deadline: the published date uses their latest known value. */
    published_without?: Record<string, string>;
    /** Latest date with every price published; after complete_through, score inputs may be late (provisional). */
    provisional_through?: string;
  };
}

export interface VxCurves {
  dates: string[];
  curves: [number, number][][];
}

export function toFloat(arr: (number | null)[]): Float64Array {
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] ?? NaN;
  return out;
}

interface RawSignals {
  dates: string[];
  series: Record<string, (number | null)[]>;
  meta: Record<string, SeriesMeta>;
}
interface RawAssets {
  dates: string[];
  assets: Record<string, Omit<AssetData, 'tr'> & { tr: (number | null)[] }>;
}

export function assemble(sig: RawSignals, ast: RawAssets, meta: MarketData['meta']): MarketData {
  if (sig.dates.length !== ast.dates.length || sig.dates.at(-1) !== ast.dates.at(-1)) {
    throw new Error('signals and assets use different calendars');
  }
  const series: Record<string, Float64Array> = {};
  for (const [k, v] of Object.entries(sig.series)) series[k] = toFloat(v);
  const assets: Record<string, AssetData> = {};
  for (const [k, v] of Object.entries(ast.assets)) assets[k] = { ...v, tr: toFloat(v.tr) };
  return { dates: sig.dates, series, seriesMeta: sig.meta, assets, meta };
}

/** The same data cut at `last` (inclusive); unchanged if `last` is missing or already the last date. */
export function truncateTo(d: MarketData, last: string | undefined): MarketData {
  if (!last) return d;
  const i = d.dates.indexOf(last);
  if (i < 0 || i === d.dates.length - 1) return d;
  const n = i + 1;
  const series: Record<string, Float64Array> = {};
  for (const [k, v] of Object.entries(d.series)) series[k] = v.slice(0, n);
  const assets: Record<string, AssetData> = {};
  for (const [k, v] of Object.entries(d.assets)) assets[k] = { ...v, tr: v.tr.slice(0, n) };
  return { ...d, dates: d.dates.slice(0, n), series, assets };
}

/** Official data only: dates after `complete_through` (provisional) removed. The live records, alerts and the default site view use this. */
export const officialData = (d: MarketData): MarketData => truncateTo(d, d.meta.complete_through);

async function getJson<T>(base: string, name: string): Promise<T> {
  // 'no-cache' = always revalidate with the server (a cheap 304 when unchanged), so a
  // reload never shows data older than the latest published update.
  const r = await fetch(`${base}data/${name}`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`failed to load ${name}: HTTP ${r.status}`);
  return (await r.json()) as T;
}

export async function loadMarketData(base: string): Promise<MarketData> {
  const [sig, ast, meta] = await Promise.all([
    getJson<RawSignals>(base, 'signals.json'),
    getJson<RawAssets>(base, 'assets.json'),
    getJson<MarketData['meta']>(base, 'meta.json'),
  ]);
  return assemble(sig, ast, meta);
}

/** Just the build metadata (small): used to detect that a newer data update was published. */
export async function loadMeta(base: string): Promise<MarketData['meta']> {
  return getJson<MarketData['meta']>(base, 'meta.json');
}

export async function loadVxCurves(base: string): Promise<VxCurves> {
  return getJson<VxCurves>(base, 'vx_curve.json');
}
