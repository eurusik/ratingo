/**
 * Client-side infinite scroll for browse pages.
 * Loads more items as user scrolls.
 */

'use client';

import { useState, useCallback } from 'react';
import { MediaCardServer, type MediaCardServerProps } from '@/modules/home';
import { InfiniteScrollLoader } from '@/modules/browse';
import type { BrowseCategory } from '@/modules/browse';

interface BrowseInfiniteListProps {
  category: BrowseCategory;
  initialPage: number;
  pageSize: number;
  loadingText?: string;
}

/**
 * Infinite scroll list that loads more items client-side.
 */
export function BrowseInfiniteList({
  category,
  initialPage,
  pageSize,
  loadingText = 'Завантаження...',
}: BrowseInfiniteListProps) {
  const [items, setItems] = useState<MediaCardServerProps[]>([]);
  const [page, setPage] = useState(initialPage + 1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      // Fetch next page via API route
      const response = await fetch(`/api/browse/${category}?page=${page}&limit=${pageSize}`);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setPage((p) => p + 1);
    } catch (error) {
      console.error('Failed to load more:', error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [category, page, pageSize, isLoading, hasMore]);

  return (
    <>
      {/* Client-loaded items */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-4">
          {items.map((item) => (
            <MediaCardServer key={item.id} {...item} locale="uk" />
          ))}
        </div>
      )}

      {/* Infinite scroll trigger */}
      <InfiniteScrollLoader
        onLoadMore={loadMore}
        isLoading={isLoading}
        hasMore={hasMore}
        loadingText={loadingText}
      />
    </>
  );
}
