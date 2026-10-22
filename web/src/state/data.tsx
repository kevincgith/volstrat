import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadMarketData, type MarketData } from '../engine/data';

interface DataState {
  data: MarketData | null;
  error: string | null;
}

const Ctx = createContext<DataState>({ data: null, error: null });

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({ data: null, error: null });
  useEffect(() => {
    loadMarketData(import.meta.env.BASE_URL)
      .then((data) => setState({ data, error: null }))
      .catch((e: unknown) => setState({ data: null, error: String(e) }));
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
