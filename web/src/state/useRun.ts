import { useEffect, useRef, useState } from 'react';
import type { Attribution } from '../engine/attribution';
import type { MarketData } from '../engine/data';
import type { Params } from '../engine/params';
import type { WireResult } from '../engine/wire';
import type { RobustnessRequest, RobustnessResult, WorkerRequest, WorkerResponse } from '../workers/engine.worker';

let worker: Worker | null = null;
let initialisedWith: MarketData | null = null;
let nextId = 1;
const listeners = new Map<number, (r: WorkerResponse) => void>();
const progress = new Map<number, (done: number, total: number) => void>();

function getWorker(data: MarketData): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.type === 'progress') {
        progress.get(ev.data.id)?.(ev.data.done, ev.data.total);
        return;
      }
      progress.delete(ev.data.id);
      const cb = listeners.get(ev.data.id);
      if (cb) {
        listeners.delete(ev.data.id);
        cb(ev.data);
      }
    };
  }
  if (initialisedWith !== data) {
    worker.postMessage({ type: 'init', data } satisfies WorkerRequest);
    initialisedWith = data;
  }
  return worker;
}

/** Run the engine in a Web Worker; debounced, latest request wins. */
export function useRun(data: MarketData | null, params: Params, debounceMs = 120) {
  const [result, setResult] = useState<WireResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [ms, setMs] = useState(0);
  const latest = useRef(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    if (!data) return;
    setRunning(true);
    const timer = setTimeout(() => {
      const id = nextId++;
      latest.current = id;
      listeners.set(id, (r) => {
        if (latest.current !== id) return;
        setRunning(false);
        if (r.type === 'result') {
          setResult(r.result);
          setMs(r.ms);
          setError(null);
        } else if (r.type === 'error') setError(r.message);
      });
      getWorker(data).postMessage({ type: 'run', id, params: JSON.parse(key) as Params } satisfies WorkerRequest);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [data, key, debounceMs]);

  return { result, error, running, ms };
}

/** One-off robustness job (grid + walk-forward) in the worker. */
export function runRobustness(
  data: MarketData,
  req: RobustnessRequest,
  onProgress: (done: number, total: number) => void,
): Promise<{ result: RobustnessResult; ms: number }> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    progress.set(id, onProgress);
    listeners.set(id, (r) => {
      if (r.type === 'robustness') resolve({ result: r.result, ms: r.ms });
      else if (r.type === 'error') reject(new Error(r.message));
    });
    getWorker(data).postMessage({ type: 'robustness', id, ...req } satisfies WorkerRequest);
  });
}

/** Leave-one-out component attribution in the worker. */
export function runAttribution(
  data: MarketData,
  params: Params,
  onProgress: (done: number, total: number) => void,
): Promise<{ result: Attribution; ms: number }> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    progress.set(id, onProgress);
    listeners.set(id, (r) => {
      if (r.type === 'attribution') resolve({ result: r.result, ms: r.ms });
      else if (r.type === 'error') reject(new Error(r.message));
    });
    getWorker(data).postMessage({ type: 'attribution', id, params } satisfies WorkerRequest);
  });
}

/** Run several parameter sets (e.g. saved profiles); results in input order. */
export function useRuns(data: MarketData | null, list: Params[]) {
  const [results, setResults] = useState<(WireResult | null)[]>([]);
  const [running, setRunning] = useState(false);
  const key = JSON.stringify(list);
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setRunning(true);
    const parsed = JSON.parse(key) as Params[];
    Promise.all(
      parsed.map(
        (params) =>
          new Promise<WireResult | null>((resolve) => {
            const id = nextId++;
            listeners.set(id, (r) => resolve(r.type === 'result' ? r.result : null));
            getWorker(data).postMessage({ type: 'run', id, params } satisfies WorkerRequest);
          }),
      ),
    ).then((rs) => {
      if (!cancelled) {
        setResults(rs);
        setRunning(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data, key]);
  return { results, running };
}
