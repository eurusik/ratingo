import type { MediaType, MovieListPath, ShowListPath } from '@/shared/api';

type BrowsePool = 'trending' | 'popular' | 'nowPlaying' | 'newReleases' | 'digital';

type BrowseSource = { type: 'movie'; path: MovieListPath } | { type: 'show'; path: ShowListPath };

interface BrowseCategoryShape {
  slug: string;
  type: MediaType;
  pool: BrowsePool;
  source: BrowseSource;
  isFilterable: boolean;
}

const BROWSE_CATEGORIES = [
  {
    slug: 'shows-trending',
    type: 'show',
    pool: 'trending',
    source: { type: 'show', path: 'catalog/shows/trending' },
    isFilterable: true,
  },
  {
    slug: 'shows-popular',
    type: 'show',
    pool: 'popular',
    source: { type: 'show', path: 'catalog/shows/popular' },
    isFilterable: true,
  },
  {
    slug: 'movies-trending',
    type: 'movie',
    pool: 'trending',
    source: { type: 'movie', path: 'catalog/movies/trending' },
    isFilterable: true,
  },
  {
    slug: 'movies-popular',
    type: 'movie',
    pool: 'popular',
    source: { type: 'movie', path: 'catalog/movies/popular' },
    isFilterable: true,
  },
  {
    slug: 'movies-now-playing',
    type: 'movie',
    pool: 'nowPlaying',
    source: { type: 'movie', path: 'catalog/movies/now-playing' },
    isFilterable: false,
  },
  {
    slug: 'movies-new-releases',
    type: 'movie',
    pool: 'newReleases',
    source: { type: 'movie', path: 'catalog/movies/new-releases' },
    isFilterable: false,
  },
  {
    slug: 'movies-digital',
    type: 'movie',
    pool: 'digital',
    source: { type: 'movie', path: 'catalog/movies/new-on-digital' },
    isFilterable: false,
  },
] as const satisfies readonly BrowseCategoryShape[];

export type BrowseCategory = (typeof BROWSE_CATEGORIES)[number];
export type BrowseCategorySlug = BrowseCategory['slug'];

export const DEFAULT_BROWSE_CATEGORY: BrowseCategory = BROWSE_CATEGORIES[0];


export const BROWSE_CATEGORY_SLUGS: readonly BrowseCategorySlug[] = BROWSE_CATEGORIES.map(
  (category) => category.slug,
);

export function findBrowseCategory(slug: string): BrowseCategory | undefined {
  return BROWSE_CATEGORIES.find((category) => category.slug === slug);
}

export function browseCategoriesOfType(type: MediaType): BrowseCategory[] {
  return BROWSE_CATEGORIES.filter((category) => category.type === type);
}

export function counterpartCategory(category: BrowseCategory, type: MediaType): BrowseCategory {
  const sameType = browseCategoriesOfType(type);
  return sameType.find((candidate) => candidate.pool === category.pool) ?? sameType[0];
}
