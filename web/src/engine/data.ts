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
}

export interface MarketData {
  dates: string[];
  series: Record<string, Float64Array>;
  seriesMeta: Record<string, SeriesMeta>;
  assets: Record<string, AssetData>;
  meta: { generated_at: string; last_date: string; sources: Record<string, SourceStatus> };
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

async function getJson<T>(base: string, name: string): Promise<T> {
  const r = await fetch(`${base}data/${name}`);
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

export async function loadVxCurves(base: string): Promise<VxCurves> {
  return getJson<VxCurves>(base, 'vx_curve.json');
}
