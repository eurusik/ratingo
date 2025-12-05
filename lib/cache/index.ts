/**
 * Простий JSON-кеш: LRU у пам’яті + опційний Redis бекенд.
 */
import { LRUCache } from '@/lib/sync/utils';
import { cacheGet as redisGet, cacheSet as redisSet } from './redis';

const MEM_MAX = Math.max(0, Number(process.env.CACHE_MEM_MAX_ENTRIES ?? 300));
const MEM_TTL_MS = Math.max(0, Number(process.env.CACHE_MEM_TTL_MS ?? 60000));
const memCache = new LRUCache<string, string>(MEM_MAX, MEM_TTL_MS);

/**
 * Дістає JSON-об’єкт за ключем з LRU/Redis; повертає `null`, якщо немає.
 */
export async function getCachedJson<T>(key: string): Promise<T | null> {
  const mem = memCache.get(key);
  if (typeof mem === 'string') {
    try {
      return JSON.parse(mem) as T;
    } catch {
      return null;
    }
  }
  const r = await redisGet(key);
  if (!r) return null;
  memCache.set(key, r);
  try {
    return JSON.parse(r) as T;
  } catch {
    return null;
  }
}

/**
 * Кладе JSON у LRU та Redis з TTL у секундах.
 */
export async function setCachedJson(key: string, obj: any, ttlSeconds: number): Promise<void> {
  const v = JSON.stringify(obj);
  memCache.set(key, v, ttlSeconds * 1000);
  await redisSet(key, v, ttlSeconds);
}

/**
 * Формує стандартизований ключ кешу на основі префікса та URL.
 * Видаляє hostname/port з URL щоб уникнути різних ключів для однакових ендпоінтів.
 */
export function makeCacheKey(prefix: string, url: string): string {
  try {
    const u = new URL(url);
    // Використовуємо тільки pathname + search, без hostname/port
    return `${prefix}:${u.pathname}${u.search}`;
  } catch {
    // Якщо URL невалідний, використовуємо як є
    return `${prefix}:${url}`;
  }
}
