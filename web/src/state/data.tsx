import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadMarketData, loadMeta, type MarketData } from '../engine/data';

const CHECK_EVERY_MS = 10 * 60 * 1000;

interface DataState {
  data: MarketData | null;
  error: string | null;
}

const Ctx = createContext<DataState>({ data: null, error: null });

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({ data: null, error: null });
  const built = useRef<string | null>(null);
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    const load = () =>
      loadMarketData(base)
        .then((data) => {
          built.current = data.meta.generated_at;
          setState({ data, error: null });
        })
        .catch((e: unknown) => setState((s) => (s.data ? s : { data: null, error: String(e) })));
    // A tab left open keeps up with new data: when it comes back to the front (and every
    // 10 minutes while visible) check the small meta file and reload if a newer build exists.
    const check = () => {
      if (document.visibilityState !== 'visible' || !built.current) return;
      loadMeta(base)
        .then((m) => {
          if (m.generated_at !== built.current) void load();
        })
        .catch(() => {});
    };
    void load();
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', check);
      clearInterval(timer);
    };
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
