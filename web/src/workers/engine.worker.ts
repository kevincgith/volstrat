/// <reference lib="webworker" />
import type { MarketData } from '../engine/data';
import type { Params } from '../engine/params';
import { attribution, type Attribution } from '../engine/attribution';
import { AXES, runGrid, walkForward, type Axis, type GridCell, type Objective, type WalkForwardResult } from '../engine/robustness';
import { run } from '../engine/run';
import { toWire } from '../engine/wire';
import { buildAssets } from '../engine/assets';

let data: MarketData | null = null;

export interface RobustnessRequest {
  params: Params;
  x: Axis;
  y: Axis;
  objective: Objective;
  trainYears: number;
  testYears: number;
}

export interface RobustnessResult {
  cells: GridCell[];
  base: GridCell['metrics'];
  walkForward: WalkForwardResult | null;
  wfDates: string[];
  axisLabels: { x: string; y: string };
}

export type WorkerRequest =
  | { type: 'init'; data: MarketData }
  | { type: 'run'; id: number; params: Params }
  | ({ type: 'robustness'; id: number } & RobustnessRequest)
  | { type: 'attribution'; id: number; params: Params };

export type WorkerResponse =
  | { type: 'result'; id: number; result: ReturnType<typeof toWire>; ms: number }
  | { type: 'progress'; id: number; done: number; total: number }
  | { type: 'robustness'; id: number; result: RobustnessResult; ms: number }
  | { type: 'attribution'; id: number; result: Attribution; ms: number }
  | { type: 'error'; id: number; message: string };

const post = (m: WorkerResponse) => (self as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    data = msg.data;
    return;
  }
  if (msg.type === 'attribution') {
    try {
      if (!data) throw new Error('engine not initialised');
      const t0 = performance.now();
      const result = attribution(data, msg.params, (done, total) => post({ type: 'progress', id: msg.id, done, total }));
      post({ type: 'attribution', id: msg.id, result, ms: performance.now() - t0 });
    } catch (e) {
      post({ type: 'error', id: msg.id, message: String(e) });
    }
    return;
  }
  if (msg.type === 'robustness') {
    try {
      if (!data) throw new Error('engine not initialised');
      const d = data;
      const t0 = performance.now();
      const grid = runGrid(d, msg.params, msg.x, msg.y, (done, total) => post({ type: 'progress', id: msg.id, done, total }));
      const base = run(d, msg.params);
      const assets = buildAssets(d, msg.params.assets);
      const wf = walkForward(d, grid, base.strategy.result.returns, assets.CASH!.returns, base.benchmarks[0]!.result.nav, {
        trainYears: msg.trainYears,
        testYears: msg.testYears,
        objective: msg.objective,
        costBps: msg.params.backtest.costBps,
      });
      post({
        type: 'robustness',
        id: msg.id,
        ms: performance.now() - t0,
        result: {
          cells: grid.cells,
          base: grid.base,
          walkForward: wf,
          wfDates: wf ? d.dates.slice(wf.start, wf.end + 1) : [],
          axisLabels: { x: AXES[msg.x.param].label, y: AXES[msg.y.param].label },
        },
      });
    } catch (e) {
      post({ type: 'error', id: msg.id, message: String(e) });
    }
    return;
  }
  if (msg.type === 'run') {
    try {
      if (!data) throw new Error('engine not initialised');
      const t0 = performance.now();
      const result = toWire(run(data, msg.params));
      (self as DedicatedWorkerGlobalScope).postMessage({ type: 'result', id: msg.id, result, ms: performance.now() - t0 } satisfies WorkerResponse);
    } catch (e) {
      (self as DedicatedWorkerGlobalScope).postMessage({ type: 'error', id: msg.id, message: String(e) } satisfies WorkerResponse);
    }
  }
};
