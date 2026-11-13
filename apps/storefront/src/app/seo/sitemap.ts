import type { MetadataRoute } from 'next';
import { configureStorefrontApi, sitemapApi } from '@/shared/api';
import { SITE_URL } from '@/shared/config';
import { buildSitemap } from '@/shared/lib';

async function orEmpty<T>(source: string, load: () => Promise<T[]>): Promise<T[]> {
  try {
    return await load();
  } catch (error) {
    console.error(`Sitemap: failed to load ${source}`, error);
    return [];
  }
}

export async function generateSitemap(): Promise<MetadataRoute.Sitemap> {
  configureStorefrontApi();

  const [movies, shows, journalPosts] = await Promise.all([
    orEmpty('movies', () => sitemapApi.getMedia('movies')),
    orEmpty('shows', () => sitemapApi.getMedia('shows')),
    orEmpty('journal posts', () => sitemapApi.getJournalPosts()),
  ]);

  return buildSitemap(SITE_URL, { now: new Date(), movies, shows, journalPosts });
}
