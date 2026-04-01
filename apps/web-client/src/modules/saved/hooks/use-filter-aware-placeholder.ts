'use client';

import { useRef } from 'react';
import { keepPreviousData } from '@tanstack/react-query';

/**
 * Returns a stable `placeholderData` value for TanStack Query hooks that combine
 * filter dimensions (type, sort) with a pagination dimension (limit).
 *
 * Rules:
 * - When only `limit` changes → return `keepPreviousData` so the list stays
 *   visible during load-more fetches (good UX for pagination).
 * - When `type` or `sort` changes → return `undefined` so stale data from the
 *   previous filter is never shown as placeholder (prevents wrong-type flash).
 *
 * Usage: pass the returned value as `placeholderData` to `useQuery`.
 *
 * @param type - The active media-type filter value
 * @param sort - The active sort value (optional; omit for hooks that have no sort)
 */
export function useFilterAwarePlaceholder(
  type: string,
  sort?: string,
): typeof keepPreviousData | undefined {
  const prevTypeRef = useRef(type);
  const prevSortRef = useRef(sort);

  const typeChanged = prevTypeRef.current !== type;
  const sortChanged = prevSortRef.current !== sort;

  prevTypeRef.current = type;
  prevSortRef.current = sort;

  // Any filter dimension change → no placeholder (clear immediately)
  if (typeChanged || sortChanged) {
    return undefined;
  }

  // Only limit changed (or first render) → keep previous data for smooth pagination
  return keepPreviousData;
}
