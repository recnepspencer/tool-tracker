import { createContext, useContext, type PropsWithChildren } from 'react';
import type { NelsonApi } from './contracts';

const ApiContext = createContext<NelsonApi | null>(null);

export function ApiProvider({ api, children }: PropsWithChildren<{ api: NelsonApi }>) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): NelsonApi {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error('useApi must be used inside ApiProvider');
  }
  return api;
}
