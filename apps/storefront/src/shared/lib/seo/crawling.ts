import type { MetadataRoute } from 'next';
import { JOURNAL_ROUTE, mediaRoute } from '@/shared/config';

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

interface DatedSlug {
  slug: string;
  updatedAt: string;
}

export interface SitemapSources {
  now: Date;
  movies: readonly DatedSlug[];
  shows: readonly DatedSlug[];
  journalPosts: ReadonlyArray<{ slug: string; publishedAt: string }>;
}

interface StaticPage {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

const STATIC_PAGES: readonly StaticPage[] = [
  { path: '', changeFrequency: 'daily', priority: 1.0 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: JOURNAL_ROUTE, changeFrequency: 'daily', priority: 0.8 },
  { path: '/browse/shows', changeFrequency: 'daily', priority: 0.9 },
  { path: '/browse/movies', changeFrequency: 'daily', priority: 0.9 },
  { path: '/browse/shows-trending', changeFrequency: 'daily', priority: 0.8 },
  { path: '/browse/shows-popular', changeFrequency: 'daily', priority: 0.8 },
  { path: '/browse/movies-trending', changeFrequency: 'daily', priority: 0.8 },
  { path: '/browse/movies-popular', changeFrequency: 'daily', priority: 0.8 },
];

const DETAIL_PAGE_CHANGE_FREQUENCY: ChangeFrequency = 'weekly';
const DETAIL_PAGE_PRIORITY = 0.7;

const DISALLOWED_PATHS = [
  '/admin',
  '/auth',
  '/settings',
  '/api',
  '/serwist',
  '/~offline',
  '/activity',
  '/calendar',
  '/saved',
  '/my',
  '/notifications',
];

function detailEntry(url: string, lastModified: string): MetadataRoute.Sitemap[number] {
  return {
    url,
    lastModified: new Date(lastModified),
    changeFrequency: DETAIL_PAGE_CHANGE_FREQUENCY,
    priority: DETAIL_PAGE_PRIORITY,
  };
}

export function buildSitemap(siteUrl: string, sources: SitemapSources): MetadataRoute.Sitemap {
  const staticEntries = STATIC_PAGES.map((page) => ({
    url: `${siteUrl}${page.path}`,
    lastModified: sources.now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
  const journalEntries = sources.journalPosts.map((post) =>
    detailEntry(`${siteUrl}${JOURNAL_ROUTE}/${post.slug}`, post.publishedAt),
  );
  const movieEntries = sources.movies.map((movie) =>
    detailEntry(`${siteUrl}${mediaRoute('movie', movie.slug)}`, movie.updatedAt),
  );
  const showEntries = sources.shows.map((show) =>
    detailEntry(`${siteUrl}${mediaRoute('show', show.slug)}`, show.updatedAt),
  );

  return [...staticEntries, ...journalEntries, ...movieEntries, ...showEntries];
}

export function buildRobots(siteUrl: string, indexingEnabled: boolean): MetadataRoute.Robots {
  if (!indexingEnabled) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: DISALLOWED_PATHS }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
