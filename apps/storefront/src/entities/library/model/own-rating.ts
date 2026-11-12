'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi } from '@/shared/api';
import { createBatchLoader } from '@/shared/lib';
import { LIBRARY_QUERY_KEY } from './save-status';

const MAX_IDS_PER_REQUEST = 100;
const NO_RATING = null;

const ratingLoader = createBatchLoader((ids) => libraryApi.getRatings(ids), MAX_IDS_PER_REQUEST);

export function useOwnRating(mediaItemId: string): number | undefined {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: [...LIBRARY_QUERY_KEY, 'rating', mediaItemId],
    queryFn: async () => (await ratingLoader.load(mediaItemId)) ?? NO_RATING,
    enabled: isAuthenticated,
  });
  return isAuthenticated ? (data ?? undefined) : undefined;
}
