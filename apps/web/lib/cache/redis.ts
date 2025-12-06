/**
 * Легка обгортка над Redis-клієнтом для кешу (необов’язковий).
 * Ініціалізується ліниво, ігнорує помилки підключення.
 */
import { createClient } from 'redis';

type Redis = ReturnType<typeof createClient>;
type CacheClient = Redis | null;

const globalForCache = globalThis as any;

/**
 * Повертає єдиний екземпляр Redis або `null`, якщо `REDIS_URL` не заданий.
 */
function getRedis(): CacheClient {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!globalForCache.__redis__) {
    const client = createClient({ url });
    client.on('error', () => {});
    client.connect().catch(() => {});
    (globalForCache as any).__redis__ = client as Redis;
  }
  return (globalForCache as any).__redis__ || null;
}

/**
 * Отримує значення за ключем з Redis; повертає `null` при помилці/відсутності.
 */
export async function cacheGet(key: string): Promise<string | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

/**
 * Встановлює ключ у Redis з TTL у секундах; мовчки ігнорує помилки.
 */
export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, value, { EX: ttlSeconds });
  } catch {}
}
