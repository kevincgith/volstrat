import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadMarketData, loadMeta, officialData, type MarketData } from '../engine/data';

const CHECK_EVERY_MS = 10 * 60 * 1000;

interface DataState {
  data: MarketData | null;
  error: string | null;
}

interface DataView extends DataState {
  /** True when the viewer chose to use dates whose score inputs are not all published yet. */
  provisional: boolean;
  setProvisional: (v: boolean) => void;
  /** The latest published date is ahead of the official one. */
  provisionalAvailable: boolean;
}

const PROVISIONAL_KEY = 'volstrat.provisional';
const readFlag = () => {
  try {
    return localStorage.getItem(PROVISIONAL_KEY) === '1';
  } catch {
    return false;
  }
};

const Ctx = createContext<DataView>({ data: null, error: null, provisional: false, setProvisional: () => {}, provisionalAvailable: false });

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
  const [provisional, setFlag] = useState<boolean>(readFlag);
  const setProvisional = (v: boolean) => {
    setFlag(v);
    try {
      localStorage.setItem(PROVISIONAL_KEY, v ? '1' : '0');
    } catch {
      /* per-viewer convenience only */
    }
  };
  const value = useMemo<DataView>(() => {
    const full = state.data;
    const ahead = !!full && !!full.meta.complete_through && full.dates.at(-1)! > full.meta.complete_through;
    // default: the official data, exactly what the live records and alerts use
    const data = full && !(provisional && ahead) ? officialData(full) : full;
    return { ...state, data, provisional: provisional && ahead, setProvisional, provisionalAvailable: ahead };
  }, [state, provisional]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
