/**
 * CSV parsers for external service export files.
 *
 * Supported sources:
 * - Kinobaza (kinobaza.com.ua): ratings + watchlist CSVs
 * - IMDB (imdb.com): V3 format, same headers for ratings and watchlist
 * - TMDB (themoviedb.org): same headers for ratings, watchlist, and favorites
 *
 * IMDB and TMDB detection samples the first data row to check if `Your Rating` is populated.
 */

export interface ParsedItem {
  imdbId?: string;
  tmdbId?: number;
  rating?: number; // raw source rating (0.5-10 scale), backend normalizes to 0-100
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

// ---------------------------------------------------------------------------
// IMDB parsers
// ---------------------------------------------------------------------------

/**
 * Splits a CSV line respecting quoted fields (e.g. `"Action, Drama"` stays as one cell).
 * Used only for lightweight synchronous detection — PapaParse handles full parsing.
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim().replace(/"/g, ''));
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim().replace(/"/g, ''));
  return cells;
}

/**
 * Detects whether an IMDB V3 CSV export is a ratings file or a watchlist file.
 *
 * IMDB uses identical column headers for both export types, so header-only
 * detection is not reliable. Instead we inspect the first data row: if the
 * `Your Rating` cell is populated the file is a ratings export, otherwise it
 * is a watchlist export.
 *
 * Note: PapaParse is intentionally NOT used here to keep detection synchronous
 * and avoid the lazy-load cost on every drag-over event.
 */
export function detectImdbFileType(csvText: string): 'ratings' | 'watchlist' | 'unknown' {
  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = text.split('\n');

  const firstLine = lines[0] ?? '';
  const headers = firstLine.split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  // The `Const` column (IMDB ID like tt1234567) is the canonical IMDB identifier
  if (!headers.includes('const')) {
    return 'unknown';
  }

  const secondLine = lines[1] ?? '';
  if (!secondLine.trim()) {
    // No data rows — cannot determine type; treat as unknown
    return 'unknown';
  }

  // Use CSV-aware split to handle quoted fields with commas (e.g. Genres)
  const cells = splitCsvLine(secondLine);
  const yourRatingIndex = headers.indexOf('your rating');

  if (yourRatingIndex === -1) {
    return 'unknown';
  }

  const yourRatingCell = cells[yourRatingIndex] ?? '';
  return yourRatingCell !== '' ? 'ratings' : 'watchlist';
}

const IMDB_REQUIRED_HEADERS = ['const', 'your rating', 'title', 'year'] as const;

/** Lazy-loads papaparse for bundle efficiency. */
export async function parseImdbRatings(csvText: string): Promise<ParseResult> {
  const Papa = (await import('papaparse')).default;

  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  const headers = result.meta.fields ?? [];
  for (const required of IMDB_REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(
        `Invalid IMDB ratings file: missing column "${required}". Found: ${headers.join(', ')}`,
      );
    }
  }

  const items: ParsedItem[] = [];
  let skippedRows = 0;

  for (const row of result.data) {
    // `Const` is the IMDB ID column (e.g. tt1234567); lowercased to `const` by transformHeader
    const imdbId = row['const']?.trim() ?? '';

    if (!imdbId) {
      skippedRows++;
      continue;
    }

    const ratingRaw = row['your rating']?.trim() ?? '';
    const titleRaw = row['title']?.trim() ?? '';
    const yearRaw = row['year']?.trim() ?? '';

    const rating = ratingRaw ? parseInt(ratingRaw, 10) : undefined;
    const year = yearRaw ? parseInt(yearRaw, 10) : undefined;

    items.push({
      imdbId,
      rating: rating && !isNaN(rating) ? rating : undefined,
      state: 'completed',
      title: titleRaw || undefined,
      year: year && !isNaN(year) ? year : undefined,
    });
  }

  return { items, skippedRows };
}

/** Lazy-loads papaparse for bundle efficiency. */
export async function parseImdbWatchlist(csvText: string): Promise<ParseResult> {
  const Papa = (await import('papaparse')).default;

  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  const headers = result.meta.fields ?? [];
  // Watchlist files still have `your rating` and `title`/`year` columns — same schema
  for (const required of IMDB_REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(
        `Invalid IMDB watchlist file: missing column "${required}". Found: ${headers.join(', ')}`,
      );
    }
  }

  const items: ParsedItem[] = [];
  let skippedRows = 0;

  for (const row of result.data) {
    const imdbId = row['const']?.trim() ?? '';

    if (!imdbId) {
      skippedRows++;
      continue;
    }

    const titleRaw = row['title']?.trim() ?? '';
    const yearRaw = row['year']?.trim() ?? '';

    const year = yearRaw ? parseInt(yearRaw, 10) : undefined;

    items.push({
      imdbId,
      state: 'planned',
      title: titleRaw || undefined,
      year: year && !isNaN(year) ? year : undefined,
    });
  }

  return { items, skippedRows };
}

// ---------------------------------------------------------------------------
// TMDB parsers
// ---------------------------------------------------------------------------

const TMDB_REQUIRED_HEADERS = ['tmdb id', 'imdb id', 'your rating', 'name'] as const;

/**
 * Detects whether a TMDB CSV export is a ratings file or a watchlist file.
 *
 * TMDB uses identical column headers for both export types. Detection is based
 * on whether the first data row has a non-empty `Your Rating` cell — the same
 * pattern used for IMDB detection.
 */
export function detectTmdbFileType(csvText: string): 'ratings' | 'watchlist' | 'unknown' {
  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = text.split('\n');

  const firstLine = lines[0] ?? '';
  const headers = firstLine.split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  if (!headers.includes('tmdb id')) {
    return 'unknown';
  }

  const secondLine = lines[1] ?? '';
  if (!secondLine.trim()) {
    // No data rows — cannot determine type; treat as unknown
    return 'unknown';
  }

  const cells = splitCsvLine(secondLine);
  const yourRatingIndex = headers.indexOf('your rating');

  if (yourRatingIndex === -1) {
    return 'unknown';
  }

  const yourRatingCell = cells[yourRatingIndex] ?? '';
  return yourRatingCell !== '' ? 'ratings' : 'watchlist';
}

/** Lazy-loads papaparse for bundle efficiency. */
export async function parseTmdbRatings(csvText: string): Promise<ParseResult> {
  const Papa = (await import('papaparse')).default;

  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  const headers = result.meta.fields ?? [];
  for (const required of TMDB_REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(
        `Invalid TMDB ratings file: missing column "${required}". Found: ${headers.join(', ')}`,
      );
    }
  }

  const items: ParsedItem[] = [];
  let skippedRows = 0;

  for (const row of result.data) {
    const tmdbRaw = row['tmdb id']?.trim() ?? '';
    const imdbRaw = row['imdb id']?.trim() ?? '';
    const ratingRaw = row['your rating']?.trim() ?? '';
    const nameRaw = row['name']?.trim() ?? '';
    const releaseDateRaw = row['release date']?.trim() ?? '';

    const tmdbId = tmdbRaw ? parseInt(tmdbRaw, 10) : NaN;
    const validTmdbId = !isNaN(tmdbId) && tmdbId !== 0 ? tmdbId : undefined;
    const imdbId = imdbRaw.startsWith('tt') ? imdbRaw : undefined;

    if (!validTmdbId && !imdbId) {
      skippedRows++;
      continue;
    }

    const rating = ratingRaw ? parseFloat(ratingRaw) : undefined;
    const yearRaw = releaseDateRaw.slice(0, 4);
    const year = yearRaw ? parseInt(yearRaw, 10) : undefined;

    items.push({
      imdbId,
      tmdbId: validTmdbId,
      rating: rating !== undefined && !isNaN(rating) && rating >= 0.5 && rating <= 10 ? rating : undefined,
      state: 'completed',
      title: nameRaw || undefined,
      year: year !== undefined && !isNaN(year) ? year : undefined,
    });
  }

  return { items, skippedRows };
}

/** Lazy-loads papaparse for bundle efficiency. */
export async function parseTmdbWatchlist(csvText: string): Promise<ParseResult> {
  const Papa = (await import('papaparse')).default;

  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });

  const headers = result.meta.fields ?? [];
  for (const required of TMDB_REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(
        `Invalid TMDB watchlist file: missing column "${required}". Found: ${headers.join(', ')}`,
      );
    }
  }

  const items: ParsedItem[] = [];
  let skippedRows = 0;

  for (const row of result.data) {
    const tmdbRaw = row['tmdb id']?.trim() ?? '';
    const imdbRaw = row['imdb id']?.trim() ?? '';
    const nameRaw = row['name']?.trim() ?? '';
    const releaseDateRaw = row['release date']?.trim() ?? '';

    const tmdbId = tmdbRaw ? parseInt(tmdbRaw, 10) : NaN;
    const validTmdbId = !isNaN(tmdbId) && tmdbId !== 0 ? tmdbId : undefined;
    const imdbId = imdbRaw.startsWith('tt') ? imdbRaw : undefined;

    if (!validTmdbId && !imdbId) {
      skippedRows++;
      continue;
    }

    const yearRaw = releaseDateRaw.slice(0, 4);
    const year = yearRaw ? parseInt(yearRaw, 10) : undefined;

    items.push({
      imdbId,
      tmdbId: validTmdbId,
      state: 'planned',
      title: nameRaw || undefined,
      year: year !== undefined && !isNaN(year) ? year : undefined,
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
  imdb: {
    slots: ['ratings', 'watchlist'],
    detectFileType: detectImdbFileType,
    parseRatings: parseImdbRatings,
    parseWatchlist: parseImdbWatchlist,
  },
  tmdb: {
    slots: ['ratings', 'watchlist'],
    detectFileType: detectTmdbFileType,
    parseRatings: parseTmdbRatings,
    parseWatchlist: parseTmdbWatchlist,
  },
};
