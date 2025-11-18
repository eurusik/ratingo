import type { MetadataRoute } from 'next';
import { getShows } from '@/lib/queries/shows';
import { getMovies } from '@/lib/queries/movies';
import { getCachedJson, setCachedJson, makeCacheKey } from '@/lib/cache/index';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const now = new Date();
  const cacheKey = makeCacheKey('sitemap', `${baseUrl}/sitemap.xml`);

  const cached = await getCachedJson<MetadataRoute.Sitemap>(cacheKey);
  if (cached) return cached;

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/trending`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/movies`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/airings`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/ideas`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ];

  const [shows, movies] = await Promise.all([
    getShows({ limit: 200, sort: 'watchers' }),
    getMovies({ limit: 200, sort: 'watchers' }),
  ]);

  const showEntries: MetadataRoute.Sitemap = shows.map((s: any) => ({
    url: `${baseUrl}/show/${s.id}`,
    lastModified: s.trendingUpdatedAt ? new Date(s.trendingUpdatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const movieEntries: MetadataRoute.Sitemap = movies.map((m: any) => ({
    url: `${baseUrl}/movie/${m.id}`,
    lastModified: m.trendingUpdatedAt ? new Date(m.trendingUpdatedAt) : now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const out = [...staticEntries, ...showEntries, ...movieEntries];
  await setCachedJson(cacheKey, out, 600);
  return out;
}
