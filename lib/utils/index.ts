/**
 * Calculate trending score based on TMDB rating and Trakt popularity
 * Formula: (tmdb_normalized * 0.4) + (trakt_normalized * 0.6)
 * Trakt is weighted higher for recency relevance
 */
export function calculateTrendingScore(
  tmdbRating: number,
  traktWatchers: number,
  maxWatchers: number = 10000 // Estimated max watchers for normalization
): number {
  // Normalize TMDB rating from 0-10 to 0-100
  const tmdbNormalized = (tmdbRating / 10) * 100;
  
  // Normalize Trakt watchers to 0-100 scale
  const traktNormalized = Math.min((traktWatchers / maxWatchers) * 100, 100);
  
  // Calculate weighted average
  const score = (tmdbNormalized * 0.4) + (traktNormalized * 0.6);
  
  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

/**
 * Format date to readable string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Check if data is stale (older than specified hours)
 */
export function isDataStale(updatedAt: Date, hours: number = 12): boolean {
  const now = new Date();
  const diff = now.getTime() - updatedAt.getTime();
  const hoursDiff = diff / (1000 * 60 * 60);
  return hoursDiff > hours;
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}
