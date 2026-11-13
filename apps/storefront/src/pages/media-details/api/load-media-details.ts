import { cache } from 'react';
import { isNotFoundError } from '@ratingo/web-core/api';
import { catalogApi, type CatalogCache, type MovieDetails, type ShowDetails } from '@/shared/api';

const DETAILS_CACHE: CatalogCache = { revalidateSeconds: 600 };

async function orNullWhenMissing<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (await isNotFoundError(error)) return null;
    throw error;
  }
}

export const loadMovie = cache((slug: string): Promise<MovieDetails | null> =>
  orNullWhenMissing(() => catalogApi.getMovieBySlug(slug, DETAILS_CACHE)),
);

export const loadShow = cache((slug: string): Promise<ShowDetails | null> =>
  orNullWhenMissing(() => catalogApi.getShowBySlug(slug, DETAILS_CACHE)),
);
