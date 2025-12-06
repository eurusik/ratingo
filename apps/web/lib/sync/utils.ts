/**
 * Обмежений пул асинхронних задач: виконує `iteratorFn` для елементів
 * масиву з максимальною конкуренцією `poolLimit`.
 */
export async function asyncPool<T, R>(
  poolLimit: number,
  array: T[],
  iteratorFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const ret: Promise<R>[] = [];
  const executing: Promise<any>[] = [];
  for (const [i, item] of array.entries()) {
    const p = Promise.resolve().then(() => iteratorFn(item, i));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

/**
 * Повторення асинхронної операції з експоненційною затримкою.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 300,
  onRetry?: (attempt: number, err: any) => void
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      try {
        if (onRetry) onRetry(attempt, err);
      } catch {}
      if (attempt > retries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Простий LRU-кеш на `Map` для обмеження пам’яті.
 */
/**
 * LRU‑кеш із підтримкою TTL для записів.
 *
 * Використовує `Map` для підтримання порядку доступу: останньо
 * використані елементи переміщаються в кінець, найстаріші — витісняються
 * при перевищенні `maxSize`. Якщо для запису задано TTL, він протухне
 * після спливу часу й буде видалений при наступному читанні.
 *
 * @template K Тип ключа
 * @template V Тип значення
 */
export class LRUCache<K, V> {
  /**
   * Внутрішній запис кешу з значенням та часом протухання (мс, `0` — без TTL).
   */
  private map = new Map<K, { value: V; expiresAt: number }>();

  /**
   * Створює LRU‑кеш.
   *
   * @param maxSize Максимальна кількість елементів у кеші (за замовчуванням `300`)
   * @param defaultTtlMs TTL за замовчуванням у мілісекундах (`0` — без протухання)
   */
  constructor(
    private maxSize = 300,
    private defaultTtlMs = 0
  ) {}

  /**
   * Повертає значення за ключем або `undefined`, якщо немає чи запис протух.
   * Оновлює порядок LRU (переміщує елемент у кінець як найсвіжіший).
   *
   * @param key Ключ запису
   * @returns Значення або `undefined`
   */
  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    const now = Date.now();
    if (entry.expiresAt > 0 && now >= entry.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /**
   * Кладе значення у кеш із опційним TTL (мс). Якщо `ttlMs` не задано,
   * використовується `defaultTtlMs`. При перевищенні `maxSize` витісняє
   * найстаріший елемент.
   *
   * @param key Ключ запису
   * @param value Значення
   * @param ttlMs TTL у мс (опційно)
   */
  set(key: K, value: V, ttlMs?: number): void {
    const ttl = Math.max(
      0,
      Number.isFinite(ttlMs as number) ? (ttlMs as number) : this.defaultTtlMs
    );
    const expiresAt = ttl > 0 ? Date.now() + ttl : 0;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    if (this.map.size > this.maxSize) {
      const firstKey = this.map.keys().next().value as K;
      this.map.delete(firstKey);
    }
  }
}

/**
 * Поєднання LRU-кешу та `withRetry`: повертає кеш або виконує запит.
 */
export async function cachedWithRetry<K, V>(
  cache: LRUCache<K, V>,
  key: K,
  _label: string,
  fn: () => Promise<V>,
  onRetry?: (attempt: number, err: any) => void
): Promise<V> {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const val = await withRetry(fn, 3, 300, onRetry);
  cache.set(key, val);
  return val;
}

/**
 * Проєкція масиву Trakt-елементів у `{ tmdbId: watchers }`.
 */
export function toWatchersMap(list: any[]): Record<number, number> {
  if (!Array.isArray(list)) return {};
  return list.reduce((acc: Record<number, number>, it: any) => {
    const tmdb = it?.show?.ids?.tmdb;
    const w = it?.watchers;
    if (typeof tmdb === 'number' && typeof w === 'number') acc[tmdb] = w;
    return acc;
  }, {});
}

/**
 * Вимірює час виконання і логгує, якщо перевищено `thresholdMs`.
 */
export async function timeAsync<T>(
  label: string,
  fn: () => Promise<T>,
  thresholdMs = 200
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const ms = Date.now() - start;
    if (ms >= thresholdMs) console.warn(`[perf] ${label} ${ms}ms`);
  }
}
