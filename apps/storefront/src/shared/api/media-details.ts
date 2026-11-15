import { cache } from 'react';
import { catalogApi, type CatalogCache, type MovieDetails, type ShowDetails } from './catalog';
import { orNullWhenNotFound } from './not-found';

const DETAILS_CACHE: CatalogCache = { revalidateSeconds: 600 };

export const loadMovieBySlug = cache((slug: string): Promise<MovieDetails | null> =>
  orNullWhenNotFound(() => catalogApi.getMovieBySlug(slug, DETAILS_CACHE)),
);

export const loadShowBySlug = cache((slug: string): Promise<ShowDetails | null> =>
  orNullWhenNotFound(() => catalogApi.getShowBySlug(slug, DETAILS_CACHE)),
);
