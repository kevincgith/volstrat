/// <reference lib="webworker" />
import type { MarketData } from '../engine/data';
import type { Params } from '../engine/params';
import { run } from '../engine/run';
import { toWire } from '../engine/wire';

let data: MarketData | null = null;

export type WorkerRequest =
  | { type: 'init'; data: MarketData }
  | { type: 'run'; id: number; params: Params };

export type WorkerResponse =
  | { type: 'result'; id: number; result: ReturnType<typeof toWire>; ms: number }
  | { type: 'error'; id: number; message: string };

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    data = msg.data;
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
