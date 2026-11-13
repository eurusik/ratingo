import { cache } from 'react';
import {
  catalogApi,
  orNullWhenNotFound,
  type CatalogCache,
  type MovieDetails,
  type ShowDetails,
} from '@/shared/api';

const DETAILS_CACHE: CatalogCache = { revalidateSeconds: 600 };

export const loadMovie = cache((slug: string): Promise<MovieDetails | null> =>
  orNullWhenNotFound(() => catalogApi.getMovieBySlug(slug, DETAILS_CACHE)),
);

export const loadShow = cache((slug: string): Promise<ShowDetails | null> =>
  orNullWhenNotFound(() => catalogApi.getShowBySlug(slug, DETAILS_CACHE)),
);
