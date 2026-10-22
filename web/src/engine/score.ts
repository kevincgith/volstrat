/**
 * Composite risk-appetite score and regime classification.
 *
 *   raw feature -> causal standardisation (0-100) -> orientation (100 = risk-on)
 *   -> weighted average over the components available that day -> optional EMA
 *   -> regimes with hysteresis.
 */

import { COMPONENTS, type ComponentDef } from './components';
import type { MarketData } from './data';
import { ema, rollingPercentile, rollingZPercentile } from './stats';

export interface ComponentSetting {
  enabled: boolean;
  weight: number;
  /** Flip the default direction (e.g. contrarian put/call). */
  invert: boolean;
}

export interface ScoreParams {
  method: 'percentile' | 'zscore';
  /** Trailing window in trading days; 0 = expanding. */
  window: number;
  /** Observations required before a component is used. */
  minPeriods: number;
  /** Minimum share of enabled weight that must be available, else score is NaN. */
  minCoverage: number;
  /** EMA span applied to the composite (1 = none). */
  smoothing: number;
  components: Record<string, ComponentSetting>;
}

export const REGIMES = ['Crisis', 'Risk-Off', 'Neutral', 'Risk-On', 'Strong Risk-On'] as const;
export type RegimeName = (typeof REGIMES)[number];

export interface RegimeParams {
  /** Four ascending cut-offs on the 0-100 score separating the five regimes. */
  thresholds: [number, number, number, number];
  /** Score must cross a cut-off by this many points to change regime (both directions). */
  hysteresis: number;
  /** Optional override of `hysteresis` for moves UP (toward risk-on). */
  bufferUp?: number;
  /** Optional override of `hysteresis` for moves DOWN (toward risk-off). */
  bufferDown?: number;
  /** Minimum trading days to stay in a regime before switching again (0 = none). */
  minHoldDays?: number;
  /** With a minimum hold, still allow moves DOWN (de-risking) immediately. */
  fastDerisk?: boolean;
}

export interface ComponentResult {
  def: ComponentDef;
  raw: Float64Array;
  /** Oriented 0-100 score (100 = risk-on). */
  score: Float64Array;
}

export interface ScoreResult {
  components: ComponentResult[];
  /** Unsmoothed composite. */
  composite: Float64Array;
  /** Smoothed composite used for allocation. */
  score: Float64Array;
  /** Share of enabled weight available each day. */
  coverage: Float64Array;
}

export function standardise(raw: Float64Array, p: Pick<ScoreParams, 'method' | 'window' | 'minPeriods'>) {
  return p.method === 'zscore'
    ? rollingZPercentile(raw, p.window, p.minPeriods)
    : rollingPercentile(raw, p.window, p.minPeriods);
}

/** Raw features are independent of every parameter; compute once and cache. */
const rawCache = new WeakMap<MarketData, Map<string, Float64Array>>();
export function rawFeature(d: MarketData, def: ComponentDef): Float64Array {
  let m = rawCache.get(d);
  if (!m) rawCache.set(d, (m = new Map()));
  let r = m.get(def.id);
  if (!r) m.set(def.id, (r = def.compute(d)));
  return r;
}

/** Standardised (un-oriented) percentiles depend only on data + standardisation settings. */
const pctCache = new WeakMap<MarketData, Map<string, Float64Array>>();
function standardisedFeature(d: MarketData, def: ComponentDef, p: ScoreParams): Float64Array {
  let m = pctCache.get(d);
  if (!m) pctCache.set(d, (m = new Map()));
  const key = `${def.id}|${p.method}|${p.window}|${p.minPeriods}`;
  let r = m.get(key);
  if (!r) {
    if (m.size > 200) m.clear();
    m.set(key, (r = standardise(rawFeature(d, def), p)));
  }
  return r;
}

export function componentScores(d: MarketData, p: ScoreParams): ComponentResult[] {
  const out: ComponentResult[] = [];
  for (const def of COMPONENTS) {
    const setting = p.components[def.id];
    if (!setting?.enabled || setting.weight <= 0) continue;
    const raw = rawFeature(d, def);
    const pct = standardisedFeature(d, def, p);
    const riskOffHigh = def.riskOffWhenHigh !== setting.invert;
    const score = riskOffHigh ? pct.map((v) => 100 - v) : pct;
    out.push({ def, raw, score });
  }
  return out;
}

export function composite(
  comps: ComponentResult[],
  settings: Record<string, ComponentSetting>,
  n: number,
  minCoverage: number,
): { composite: Float64Array; coverage: Float64Array } {
  const total = comps.reduce((a, c) => a + (settings[c.def.id]?.weight ?? 0), 0);
  const out = new Float64Array(n).fill(NaN);
  const cov = new Float64Array(n).fill(0);
  for (let t = 0; t < n; t++) {
    let ws = 0;
    let acc = 0;
    for (const c of comps) {
      const v = c.score[t]!;
      if (Number.isFinite(v)) {
        const w = settings[c.def.id]!.weight;
        ws += w;
        acc += w * v;
      }
    }
    cov[t] = total > 0 ? ws / total : 0;
    if (ws > 0 && cov[t]! >= minCoverage) out[t] = acc / ws;
  }
  return { composite: out, coverage: cov };
}

export function computeScore(d: MarketData, p: ScoreParams): ScoreResult {
  const comps = componentScores(d, p);
  const { composite: c, coverage } = composite(comps, p.components, d.dates.length, p.minCoverage);
  return { components: comps, composite: c, score: ema(c, p.smoothing), coverage };
}

/** Regime index (0 = Crisis ... 4 = Strong Risk-On) without hysteresis. */
export function rawRegime(score: number, th: RegimeParams['thresholds']): number {
  let r = 0;
  for (const cut of th) if (score >= cut) r++;
  return r;
}

/**
 * Regime path with hysteresis: the regime only changes once the score moves
 * past the relevant cut-off by `hysteresis` points. -1 = no score.
 */
export function regimes(score: Float64Array, p: RegimeParams): Int8Array {
  const out = new Int8Array(score.length).fill(-1);
  const th = p.thresholds;
  const up = Math.max(0, p.bufferUp ?? p.hysteresis);
  const down = Math.max(0, p.bufferDown ?? p.hysteresis);
  const hold = Math.max(0, Math.floor(p.minHoldDays ?? 0));
  const fastDerisk = p.fastDerisk ?? true;
  let cur = -1;
  let since = 0; // days spent in the current regime
  for (let t = 0; t < score.length; t++) {
    const s = score[t]!;
    if (!Number.isFinite(s)) {
      cur = -1;
      continue;
    }
    const raw = rawRegime(s, th);
    if (cur < 0) {
      cur = raw;
      since = 0;
    } else {
      let next = cur;
      if (raw > cur) {
        // move up only past the regime's upper cut-off + buffer; land on the highest regime cleared
        while (next < 4 && s >= th[next]! + up) next++;
      } else if (raw < cur) {
        while (next > 0 && s < th[next - 1]! - down) next--;
      }
      const held = since >= hold;
      if (next !== cur && (held || (next < cur && fastDerisk))) {
        cur = next;
        since = 0;
      }
    }
    since++;
    out[t] = cur;
  }
  return out;
}
