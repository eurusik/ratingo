/**
 * CSV parsers for Kinobaza export files.
 *
 * Supports two export formats:
 * - Ratings CSV (has `my_rating` column)
 * - Watchlist CSV (no `my_rating` column)
 */

export interface ParsedItem {
  imdbId?: string;
  tmdbId?: number;
  rating?: number; // raw Kinobaza 1-10, backend will normalize
  state: 'completed' | 'planned';
  title?: string;
  year?: number;
}

export interface ParseResult {
  items: ParsedItem[];
  skippedRows: number;
}

const RATINGS_REQUIRED_HEADERS = ['kinobazaua_id', 'imdb_id', 'themoviedb_id', 'my_rating'] as const;
const WATCHLIST_REQUIRED_HEADERS = ['kinobazaua_id', 'imdb_id', 'themoviedb_id'] as const;

/** Parses only the header row for efficiency — avoids loading the full file. */
export function detectKinobazaFileType(csvText: string): 'ratings' | 'watchlist' | 'unknown' {
  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');
  const firstLine = text.split('\n')[0] ?? '';
  const headers = firstLine.split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  const hasKinobazaId = headers.includes('kinobazaua_id');
  if (!hasKinobazaId) {
    return 'unknown';
  }

  if (headers.includes('my_rating')) {
    return 'ratings';
  }

  return 'watchlist';
}

/** Lazy-loads papaparse for bundle efficiency. */
export async function parseKinobazaRatings(csvText: string): Promise<ParseResult> {
  const Papa = (await import('papaparse')).default;

  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  const headers = result.meta.fields ?? [];
  for (const required of RATINGS_REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(
        `Invalid Kinobaza ratings file: missing column "${required}". Found: ${headers.join(', ')}`,
      );
    }
  }

  const items: ParsedItem[] = [];
  let skippedRows = 0;

  for (const row of result.data) {
    const imdbRaw = row['imdb_id']?.trim() ?? '';
    const tmdbRaw = row['themoviedb_id']?.trim() ?? '';
    const ratingRaw = row['my_rating']?.trim() ?? '';
    const nameEn = row['name_en']?.trim() ?? '';
    const nameUk = row['name_uk']?.trim() ?? '';
    const yearRaw = row['year']?.trim() ?? '';

    // Require at least one identifier to be usable
    const tmdbId = tmdbRaw && tmdbRaw !== '0' ? parseInt(tmdbRaw, 10) : undefined;
    const imdbId = imdbRaw && imdbRaw !== '0' ? imdbRaw : undefined;

    if (!imdbId && !tmdbId) {
      skippedRows++;
      continue;
    }

    const rating = ratingRaw ? parseInt(ratingRaw, 10) : undefined;
    const year = yearRaw ? parseInt(yearRaw, 10) : undefined;
    const title = nameEn || nameUk || undefined;

    items.push({
      imdbId,
      tmdbId: tmdbId && !isNaN(tmdbId) ? tmdbId : undefined,
      rating: rating && !isNaN(rating) ? rating : undefined,
      state: 'completed',
      title,
      year: year && !isNaN(year) ? year : undefined,
    });
  }

  return { items, skippedRows };
}

/** Lazy-loads papaparse for bundle efficiency. */
export async function parseKinobazaWatchlist(csvText: string): Promise<ParseResult> {
  const Papa = (await import('papaparse')).default;

  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  const headers = result.meta.fields ?? [];
  for (const required of WATCHLIST_REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(
        `Invalid Kinobaza watchlist file: missing column "${required}". Found: ${headers.join(', ')}`,
      );
    }
  }

  const items: ParsedItem[] = [];
  let skippedRows = 0;

  for (const row of result.data) {
    const imdbRaw = row['imdb_id']?.trim() ?? '';
    const tmdbRaw = row['themoviedb_id']?.trim() ?? '';
    const nameEn = row['name_en']?.trim() ?? '';
    const nameUk = row['name_uk']?.trim() ?? '';
    const yearRaw = row['year']?.trim() ?? '';

    const tmdbId = tmdbRaw && tmdbRaw !== '0' ? parseInt(tmdbRaw, 10) : undefined;
    const imdbId = imdbRaw && imdbRaw !== '0' ? imdbRaw : undefined;

    if (!imdbId && !tmdbId) {
      skippedRows++;
      continue;
    }

    const year = yearRaw ? parseInt(yearRaw, 10) : undefined;
    const title = nameEn || nameUk || undefined;

    items.push({
      imdbId,
      tmdbId: tmdbId && !isNaN(tmdbId) ? tmdbId : undefined,
      state: 'planned',
      title,
      year: year && !isNaN(year) ? year : undefined,
    });
  }

  return { items, skippedRows };
}

export interface SourceParserConfig {
  /** Which file slots this source supports */
  slots: ('ratings' | 'watchlist')[];
  detectFileType: (csvText: string) => 'ratings' | 'watchlist' | 'unknown';
  parseRatings: (csvText: string) => Promise<ParseResult>;
  parseWatchlist: (csvText: string) => Promise<ParseResult>;
}

export const SOURCE_PARSERS: Record<string, SourceParserConfig> = {
  kinobaza: {
    slots: ['ratings', 'watchlist'],
    detectFileType: detectKinobazaFileType,
    parseRatings: parseKinobazaRatings,
    parseWatchlist: parseKinobazaWatchlist,
  },
};
