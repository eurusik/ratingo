/**
 * Context for header breadcrumb/context information.
 * Allows detail pages to inject contextual information into the header.
 */

'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface HeaderContextValue {
  /** Breadcrumb text (e.g., "Серіал • У тренді") */
  breadcrumb?: string;
  /** Back link URL */
  backUrl?: string;
}

interface HeaderContextAPI extends HeaderContextValue {
  /** Set header context */
  setContext: (context: HeaderContextValue) => void;
  /** Clear header context */
  clearContext: () => void;
}

const HeaderContext = createContext<HeaderContextAPI | null>(null);

interface HeaderContextProviderProps {
  children: ReactNode;
}

export function HeaderContextProvider({ children }: HeaderContextProviderProps) {
  const [context, setContextState] = useState<HeaderContextValue>({});

  const setContext = useCallback((newContext: HeaderContextValue) => {
    setContextState(newContext);
  }, []);

  const clearContext = useCallback(() => {
    setContextState({});
  }, []);

  return (
    <HeaderContext.Provider value={{ ...context, setContext, clearContext }}>
      {children}
    </HeaderContext.Provider>
  );
}

/**
 * Hook to access header context.
 */
export function useHeaderContext() {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('useHeaderContext must be used within HeaderContextProvider');
  }
  return context;
}
