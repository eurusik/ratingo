/**
 * TanStack Query client configuration.
 *
 * Provides singleton QueryClient with SSR support.
 */

import { QueryClient, isServer } from '@tanstack/react-query';

/**
 * Creates new QueryClient with default options.
 *
 * Default settings:
 * - 1 minute stale time
 * - 5 minutes garbage collection
 * - No refetch on window focus
 * - Single retry on failure
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
        refetchOnMount: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Gets or creates QueryClient instance.
 *
 * - Server: Creates new client per request
 * - Browser: Returns singleton client
 *
 * @returns QueryClient instance
 */
export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
