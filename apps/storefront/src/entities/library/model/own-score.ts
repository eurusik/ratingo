'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi } from '@/shared/api';
import { createBatchLoader, scoreFromPercent } from '@/shared/lib';
import { MAX_IDS_PER_REQUEST, ownScoreKey } from './library-keys';

const NOT_RATED = null;

const ratingLoader = createBatchLoader((ids) => libraryApi.getRatings(ids), MAX_IDS_PER_REQUEST);

export function useOwnScore(mediaItemId: string): number | undefined {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: ownScoreKey(mediaItemId),
    queryFn: async () => (await ratingLoader.load(mediaItemId)) ?? NOT_RATED,
    enabled: isAuthenticated,
  });
  return isAuthenticated ? scoreFromPercent(data) : undefined;
}
