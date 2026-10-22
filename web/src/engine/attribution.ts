/**
 * Component attribution by leave-one-out: re-run the strategy without each
 * enabled component (weights of the rest rescale automatically), and with that
 * component alone. All runs use the base run's period so the deltas are
 * comparable; a component-alone run that cannot start that early is reported
 * from its own first date.
 */

import type { MarketData } from './data';
import type { Metrics } from './metrics';
import { merge, type Params } from './params';
import { run } from './run';

export interface AttributionRow {
  id: string;
  without: Metrics;
  alone: Metrics;
}

export interface Attribution {
  base: Metrics;
  rows: AttributionRow[];
}

export function attribution(d: MarketData, p: Params, onProgress?: (done: number, total: number) => void): Attribution {
  const baseRun = run(d, p);
  const period = { start: d.dates[baseRun.start]!, end: d.dates[baseRun.end]!, oosStart: '' };
  const ids = Object.entries(p.score.components)
    .filter(([, s]) => s.enabled && s.weight > 0)
    .map(([id]) => id);
  const rows: AttributionRow[] = [];
  let done = 0;
  const total = ids.length * 2;
  for (const id of ids) {
    const without = merge(p, { period, score: { components: { [id]: { enabled: false } } } });
    const alone = merge(p, {
      period,
      score: {
        minCoverage: 0,
        components: Object.fromEntries(ids.map((k) => [k, { enabled: k === id }])),
      },
    });
    const w = run(d, without).strategy.metrics;
    onProgress?.(++done, total);
    const a = run(d, alone).strategy.metrics;
    onProgress?.(++done, total);
    rows.push({ id, without: w, alone: a });
  }
  return { base: baseRun.strategy.metrics, rows };
}
