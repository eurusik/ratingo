'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';

import { catalogApi } from '@/core/api/catalog';
import { queryKeys } from '@/core/query/keys';

/**
 * Hook for search dialog state and logic.
 */
export function useSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);
  const router = useRouter();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search query
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.search.results(debouncedQuery),
    queryFn: () => catalogApi.search({ query: debouncedQuery }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 1000 * 60 * 5,
  });

  // Navigate to local item
  const handleSelect = useCallback(
    (slug: string, type: 'movie' | 'show') => {
      setOpen(false);
      setQuery('');
      router.push(type === 'movie' ? `/movies/${slug}` : `/shows/${slug}`);
    },
    [router],
  );

  // Import TMDB item
  const [importingTmdbId, setImportingTmdbId] = useState<number | null>(null);

  const importMutation = useMutation({
    mutationFn: async ({ tmdbId, type }: { tmdbId: number; type: 'movie' | 'show' }) => {
      return type === 'movie'
        ? catalogApi.importMovie(tmdbId)
        : catalogApi.importShow(tmdbId);
    },
    onSuccess: (result) => {
      if (result.status === 'ready' && result.slug) {
        setOpen(false);
        setQuery('');
        router.push(result.type === 'movie' ? `/movies/${result.slug}` : `/shows/${result.slug}`);
      } else if (result.status === 'importing' || result.status === 'exists') {
        setOpen(false);
        setQuery('');
        router.push(`/import/${result.tmdbId}?type=${result.type}` as any);
      }
      setImportingTmdbId(null);
    },
    onError: () => {
      setImportingTmdbId(null);
    },
  });

  const handleImport = useCallback(
    (tmdbId: number, type: 'movie' | 'show') => {
      setImportingTmdbId(tmdbId);
      importMutation.mutate({ tmdbId, type });
    },
    [importMutation],
  );

  const hasResults = (data?.local?.length ?? 0) > 0 || (data?.tmdb?.length ?? 0) > 0;

  return {
    // Dialog state
    open,
    setOpen,
    query,
    setQuery,
    debouncedQuery,

    // Search results
    data,
    isLoading,
    hasResults,

    // Actions
    handleSelect,
    handleImport,
    importingTmdbId,
  };
}
