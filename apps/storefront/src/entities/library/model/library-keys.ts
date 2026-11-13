export const LIBRARY_QUERY_KEY = ['library'] as const;

export const MAX_IDS_PER_REQUEST = 100;

export function saveStatusKey(mediaItemId: string) {
  return [...LIBRARY_QUERY_KEY, 'save-status', mediaItemId] as const;
}

export function ownScoreKey(mediaItemId: string) {
  return [...LIBRARY_QUERY_KEY, 'own-score', mediaItemId] as const;
}
