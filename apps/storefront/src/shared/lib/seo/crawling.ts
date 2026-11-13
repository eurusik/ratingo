import type { MetadataRoute } from 'next';
import {
  BROWSE_ROUTE,
  CALENDAR_ROUTE,
  HOME_ROUTE,
  JOURNAL_ROUTE,
  MY_ROUTE,
  NOTIFICATIONS_ROUTE,
  OFFLINE_ROUTE,
  SETTINGS_ROUTE,
  mediaRoute,
} from '@/shared/config';

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
  { path: HOME_ROUTE, changeFrequency: 'daily', priority: 1.0 },
  { path: BROWSE_ROUTE, changeFrequency: 'daily', priority: 0.9 },
];

const DETAIL_PAGE_CHANGE_FREQUENCY: ChangeFrequency = 'weekly';
const DETAIL_PAGE_PRIORITY = 0.7;

const LEGACY_PRIVATE_PATHS = ['/admin', '/activity', '/saved'];

const DISALLOWED_PATHS = [
  ...LEGACY_PRIVATE_PATHS,
  '/auth',
  '/api',
  '/serwist',
  OFFLINE_ROUTE,
  SETTINGS_ROUTE,
  CALENDAR_ROUTE,
  MY_ROUTE,
  NOTIFICATIONS_ROUTE,
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
    url: page.path === HOME_ROUTE ? siteUrl : `${siteUrl}${page.path}`,
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
