/**
 * Formatting utilities for UI display.
 *
 * All formatters return empty string for null/undefined values.
 */

/**
 * Format number with K/M suffixes.
 *
 * @example
 * formatNumber(1200) // "1.2K"
 * formatNumber(5600000) // "5.6M"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '';

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return value.toString();
}

/**
 * Format rating to one decimal place.
 *
 * @example
 * formatRating(8.234) // "8.2"
 * formatRating(null) // "—"
 */
export function formatRating(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toFixed(1);
}

/**
 * Format ISO date string to Ukrainian locale.
 *
 * @example
 * formatDate("2025-12-19") // "19 гру 2025"
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';

  const date = new Date(dateString);
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Extract year from date string.
 *
 * @example
 * formatYear("2024-02-27") // "2024"
 */
export function formatYear(dateString: string | null | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).getFullYear().toString();
}

/**
 * Format episode code.
 *
 * @example
 * formatEpisode(4, 9) // "S4E9"
 */
export function formatEpisode(season: number, episode: number): string {
  return `S${season}E${episode}`;
}
