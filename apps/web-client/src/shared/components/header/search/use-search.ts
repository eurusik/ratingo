'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';

import { catalogApi, ImportStatus, MediaType } from '@/core/api/catalog';
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
    (slug: string, type: MediaType) => {
      setOpen(false);
      setQuery('');
      router.push(type === MediaType.MOVIE ? `/movies/${slug}` : `/shows/${slug}`);
    },
    [router],
  );

  // Import TMDB item
  const [importingTmdbId, setImportingTmdbId] = useState<number | null>(null);

  // Store item info for redirect
  const [importingItem, setImportingItem] = useState<{
    title: string;
    poster?: string;
    year?: number;
  } | null>(null);

  const importMutation = useMutation({
    mutationFn: async ({ tmdbId, type }: { tmdbId: number; type: MediaType }) => {
      return type === MediaType.MOVIE
        ? catalogApi.importMovie(tmdbId)
        : catalogApi.importShow(tmdbId);
    },
    onSuccess: (result) => {
      if (result.status === ImportStatus.READY && result.slug) {
        setOpen(false);
        setQuery('');
        router.push(result.type === MediaType.MOVIE ? `/movies/${result.slug}` : `/shows/${result.slug}`);
      } else if (result.status === ImportStatus.IMPORTING || result.status === ImportStatus.EXISTS) {
        setOpen(false);
        setQuery('');
        // Pass title, poster, slug and jobId via query params for better UX
        const params = new URLSearchParams({
          type: result.type,
          title: importingItem?.title || '',
          ...(importingItem?.poster && { poster: importingItem.poster }),
          ...(importingItem?.year && { year: String(importingItem.year) }),
          ...(result.jobId && { jobId: result.jobId }),
          ...(result.slug && { slug: result.slug }),
        });
        router.push(`/import/${result.tmdbId}?${params.toString()}` as any);
      }
      setImportingTmdbId(null);
      setImportingItem(null);
    },
    onError: () => {
      setImportingTmdbId(null);
      setImportingItem(null);
    },
  });

  const handleImport = useCallback(
    (tmdbId: number, type: MediaType, title: string, poster?: string, year?: number) => {
      setImportingTmdbId(tmdbId);
      setImportingItem({ title, poster, year });
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
