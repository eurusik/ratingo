'use client';

import { useEffect } from 'react';
import { CancelledError, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiError } from '@ratingo/web-core/api';
import { track } from './track';

const AREA_SEGMENTS = 2;
const UNKNOWN_AREA = 'unknown';
const UNAUTHORIZED = 401;

function areaOf(key: QueryKey | undefined): string {
  const segments = (key ?? [])
    .slice(0, AREA_SEGMENTS)
    .filter((segment): segment is string | number => {
      return typeof segment === 'string' || typeof segment === 'number';
    });
  return segments.length > 0 ? segments.join('.') : UNKNOWN_AREA;
}

function isAborted(error: unknown): boolean {
  return error instanceof CancelledError || (error instanceof Error && error.name === 'AbortError');
}

function report(kind: 'mutation' | 'query', key: QueryKey | undefined, error: unknown): void {
  if (isAborted(error)) return;
  const status = error instanceof ApiError ? error.statusCode : undefined;
  if (status === UNAUTHORIZED) return;
  track('app_error', {
    kind,
    area: areaOf(key),
    status,
    code: error instanceof ApiError ? error.code : undefined,
  });
}

export function ApiErrorReporter() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribeMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;
      report(
        'mutation',
        event.mutation.options.mutationKey as QueryKey | undefined,
        event.action.error,
      );
    });
    const unsubscribeQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;
      report('query', event.query.queryKey as QueryKey, event.action.error);
    });
    return () => {
      unsubscribeMutations();
      unsubscribeQueries();
    };
  }, [queryClient]);

  return null;
}
