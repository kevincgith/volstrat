/**
 * Trading-cost sensitivity: strategy and benchmark statistics across cost
 * levels, and the break-even cost (bp per side, applied to every asset) at
 * which the strategy's Sharpe falls to the benchmark's. Benchmarks pay the
 * same cost, so low-turnover benchmarks are barely affected.
 */

import type { MarketData } from './data';
import type { Metrics } from './metrics';
import { merge, type Params } from './params';
import { run } from './run';

interface DataLikeRun {
  s: Metrics;
  b: Metrics;
  label: string;
}

export interface CostPoint {
  bps: number;
  sharpe: number;
  cagr: number;
  benchSharpe: number;
  costDrag: number;
}

export interface CostSensitivity {
  benchmark: string;
  points: CostPoint[];
  /** bp per side where Sharpe(strategy) = Sharpe(benchmark); null if never / always below. */
  breakEven: number | null;
  breakEvenNote: string;
  turnover: number;
}

export function costSensitivity(d: MarketData, p: Params, benchId: string, levels = [0, 2, 5, 10, 20, 50]): CostSensitivity {
  const at = (bps: number): DataLikeRun => {
    const r = run(d, merge(p, { backtest: { costBps: bps, assetCostBps: {} } }));
    const b = r.benchmarks.find((x) => x.id === benchId) ?? r.benchmarks[0]!;
    return { s: r.strategy.metrics, b: b.metrics, label: b.label };
  };
  const points = levels.map((bps) => {
    const x = at(bps);
    return { bps, sharpe: x.s.sharpe, cagr: x.s.cagr, benchSharpe: x.b.sharpe, costDrag: x.s.costDrag };
  });
  const gap = (bps: number) => {
    const x = at(bps);
    return x.s.sharpe - x.b.sharpe;
  };
  let breakEven: number | null = null;
  let note = '';
  const g0 = gap(0);
  if (g0 <= 0) note = 'The strategy does not beat this benchmark even with zero costs.';
  else {
    let lo = 0;
    let hi = 200;
    if (gap(hi) > 0) note = 'The edge survives even at 200 bp per side.';
    else {
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (gap(mid) > 0) lo = mid;
        else hi = mid;
      }
      breakEven = (lo + hi) / 2;
    }
  }
  const base = at(p.backtest.costBps);
  return { benchmark: base.label, points, breakEven, breakEvenNote: note, turnover: base.s.turnover };
}
