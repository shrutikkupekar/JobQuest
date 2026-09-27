import { createContext, useContext } from 'react';

const ApiContext = createContext(null);

export function ApiProvider({ api, children }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
}
