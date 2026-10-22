import { useEffect, useRef, useState } from 'react';
import type { MarketData } from '../engine/data';
import type { Params } from '../engine/params';
import type { WireResult } from '../engine/wire';
import type { WorkerRequest, WorkerResponse } from '../workers/engine.worker';

let worker: Worker | null = null;
let initialisedWith: MarketData | null = null;
let nextId = 1;
const listeners = new Map<number, (r: WorkerResponse) => void>();

function getWorker(data: MarketData): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
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
        } else setError(r.message);
      });
      getWorker(data).postMessage({ type: 'run', id, params: JSON.parse(key) as Params } satisfies WorkerRequest);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [data, key, debounceMs]);

  return { result, error, running, ms };
}
