/**
 * Dynamic sitemap generation.
 * Includes static pages and dynamic journal posts.
 */

import type { MetadataRoute } from 'next';
import { journalApi } from '@/core/api/journal';

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
  { path: '/browse/movies-trending', changeFrequency: 'daily', priority: 0.8 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${BASE_URL}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  // Journal posts
  let journalEntries: MetadataRoute.Sitemap = [];
  try {
    const response = await journalApi.getPosts({ limit: 100 });
    journalEntries = response.posts.map((post) => ({
      url: `${BASE_URL}/journal/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch {
    // If API fails, continue without journal entries
    console.error('Failed to fetch journal posts for sitemap');
  }

  return [...staticEntries, ...journalEntries];
}
