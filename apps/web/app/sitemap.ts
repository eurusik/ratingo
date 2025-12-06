import type { MetadataRoute } from 'next';
import { getShows } from '@/lib/queries/shows';
import { getMovies } from '@/lib/queries/movies';
import { getCachedJson, setCachedJson, makeCacheKey } from '@/lib/cache/index';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 600;

/**
 * Значення таймауту за замовчуванням для запитів до БД у sitemap.
 */
const DEFAULT_SITEMAP_TIMEOUT_MS = 10000;

/**
 * Виконує проміс із таймаутом і повертає запасне значення у разі перевищення часу.
 *
 * @template T
 * @param promise Проміс, який потрібно виконати з обмеженням часу
 * @param timeoutMs Таймаут у мілісекундах
 * @param fallback Значення, яке повертається у разі таймауту або скасування
 * @returns Результат промісу або запасне значення
 */
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  const ms = Math.max(500, Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_SITEMAP_TIMEOUT_MS);
  return await Promise.race<T>([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Отримує топ-шоу для sitemap; у разі помилки повертає порожній список.
 *
 * @returns Масив шоу (мінімальний набір полів для sitemap)
 */
async function fetchTopShows(): Promise<any[]> {
  try {
    return await getShows({ limit: 200, sort: 'watchers' });
  } catch {
    return [] as any[];
  }
}

/**
 * Отримує топ-фільми для sitemap; у разі помилки повертає порожній список.
 *
 * @returns Масив фільмів (мінімальний набір полів для sitemap)
 */
async function fetchTopMovies(): Promise<any[]> {
  try {
    return await getMovies({ limit: 200, sort: 'watchers' });
  } catch {
    return [] as any[];
  }
}

async function resolveBaseUrl(): Promise<string> {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL;
  if (envBase && !envBase.includes('localhost')) return envBase;
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return envBase || 'http://localhost:3000';
}

/**
 * Генератор карти сайту (sitemap.xml).
 *
 * Джерела:
 * - Статичні маршрути (головна, тренди, фільми, надходження, проєкт, ідеї)
 * - Динамічні сторінки шоу та фільмів із БД (топ за переглядами)
 *
 * Продуктивність:
 * - Результат кешується (LRU/Redis) на 600 секунд, щоб уникати повторних важких запитів.
 *
 * Абсолютні URL:
 * - Формуються з `NEXT_PUBLIC_SITE_URL` (fallback: `http://localhost:3000`).
 *
 * @returns Масив записів Sitemap для App Router (`MetadataRoute.Sitemap`).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await resolveBaseUrl();
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

  const timeoutMs = Number(process.env.SITEMAP_DB_TIMEOUT_MS ?? DEFAULT_SITEMAP_TIMEOUT_MS);

  const [shows, movies] = await Promise.all([
    fetchWithTimeout(fetchTopShows(), timeoutMs, [] as any[]),
    fetchWithTimeout(fetchTopMovies(), timeoutMs, [] as any[]),
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
