export interface CatalogCache {
  revalidateSeconds: number;
}

const CACHED_REQUEST_TIMEOUT_MS = 5000;

export function cacheOptions(cache: CatalogCache | undefined) {
  if (!cache) return {};
  return {
    next: { revalidate: cache.revalidateSeconds },
    timeout: CACHED_REQUEST_TIMEOUT_MS,
    retry: { limit: 1 },
  };
}
