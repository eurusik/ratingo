/**
 * Dynamic sitemap generation.
 * Includes static pages, dynamic journal posts, movies, and shows.
 */

import type { MetadataRoute } from 'next';
import { journalApi } from '@/core/api/journal.client';
import { apiGet } from '@/core/api/client';

/** Single entry returned by the catalog sitemap endpoints. */
interface SitemapItem {
  slug: string;
  updatedAt: string;
}

/** Response shape from GET /catalog/sitemap/movies and GET /catalog/sitemap/shows. */
interface CatalogSitemapResponse {
  items: SitemapItem[];
}

/**
 * Fetches movie slugs for sitemap generation.
 * Returns an empty array on failure so the sitemap remains valid.
 */
async function fetchMoviesSitemap(): Promise<SitemapItem[]> {
  try {
    const response = await apiGet<CatalogSitemapResponse>('catalog/sitemap/movies');
    return response.items;
  } catch {
    console.error('Failed to fetch movies sitemap');
    return [];
  }
}

/**
 * Fetches show slugs for sitemap generation.
 * Returns an empty array on failure so the sitemap remains valid.
 */
async function fetchShowsSitemap(): Promise<SitemapItem[]> {
  try {
    const response = await apiGet<CatalogSitemapResponse>('catalog/sitemap/shows');
    return response.items;
  } catch {
    console.error('Failed to fetch shows sitemap');
    return [];
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ratingo.top';

/**
 * Static pages with their change frequency and priority.
 */
const STATIC_PAGES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '', changeFrequency: 'daily', priority: 1.0 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/journal', changeFrequency: 'daily', priority: 0.8 },
  { path: '/browse/shows', changeFrequency: 'daily', priority: 0.9 },
  { path: '/browse/movies', changeFrequency: 'daily', priority: 0.9 },
  { path: '/browse/shows-trending', changeFrequency: 'daily', priority: 0.8 },
  { path: '/browse/shows-popular', changeFrequency: 'daily', priority: 0.8 },
  { path: '/browse/movies-trending', changeFrequency: 'daily', priority: 0.8 },
  { path: '/browse/movies-popular', changeFrequency: 'daily', priority: 0.8 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  // Fetch journal posts, movies, and shows in parallel
  let journalEntries: MetadataRoute.Sitemap = [];
  const [movieItems, showItems] = await Promise.all([
    fetchMoviesSitemap(),
    fetchShowsSitemap(),
    // Journal posts fetched separately to preserve its own error handling pattern
    journalApi
      .getPosts({ limit: 100 })
      .then((response) => {
        journalEntries = response.posts.map((post) => ({
          url: `${BASE_URL}/journal/${post.slug}`,
          lastModified: new Date(post.publishedAt),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        }));
      })
      .catch(() => {
        console.error('Failed to fetch journal posts for sitemap');
      }),
  ]);

  const movieEntries: MetadataRoute.Sitemap = movieItems.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/movies/${slug}`,
    lastModified: new Date(updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const showEntries: MetadataRoute.Sitemap = showItems.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/shows/${slug}`,
    lastModified: new Date(updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...journalEntries, ...movieEntries, ...showEntries];
}
