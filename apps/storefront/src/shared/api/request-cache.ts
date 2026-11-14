export interface CatalogCache {
  revalidateSeconds: number;
  timeoutMs?: number;
  retries?: number;
}

const CACHED_REQUEST_TIMEOUT_MS = 5000;
const CACHED_REQUEST_RETRIES = 1;

export function cacheOptions(cache: CatalogCache | undefined) {
  if (!cache) return {};
  return {
    next: { revalidate: cache.revalidateSeconds },
    timeout: cache.timeoutMs ?? CACHED_REQUEST_TIMEOUT_MS,
    retry: { limit: cache.retries ?? CACHED_REQUEST_RETRIES },
  };
}
