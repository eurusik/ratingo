'use client';

/**
 * TanStack Query provider for React.
 *
 * Wraps application with QueryClientProvider and
 * includes DevTools in development mode.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { getQueryClient } from '../query/client';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * Provides QueryClient context to React tree.
 *
 * @param props - Component props
 * @param props.children - Child components
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
