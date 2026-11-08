export const DEFAULT_REGION = 'UA';
export const DEFAULT_LANGUAGE = 'uk-UA';

// Time constants (milliseconds)
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
export const SECONDS_PER_DAY = MS_PER_DAY / MS_PER_SECOND;
export const MS_PER_YEAR = 365 * MS_PER_DAY;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_BATCH_SIZE = 50;

export const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// Catalog Defaults
export const CATALOG_DEFAULT_LIMIT = DEFAULT_PAGE_SIZE;
export const CATALOG_DEFAULT_OFFSET = 0;
export const CATALOG_DEFAULT_CALENDAR_DAYS = 7;
export const CATALOG_MAX_CALENDAR_DAYS = 90;
export const CATALOG_DEFAULT_NEW_RELEASE_DAYS = 30;
export const CATALOG_DEFAULT_DIGITAL_DAYS = 14;
export const CATALOG_MAX_DAYS_BACK = 365;

export const NEW_RELEASES_REGION = 'US';
export const NEW_RELEASES_MIN_VOTE_COUNT = 5;
export const NEW_RELEASES_MAX_PRIMARY_RELEASE_AGE_DAYS = 180;

// Digital Release Freshness — only show movies originally released within this window
// Excludes re-releases of old classics (e.g., Harry Potter re-released on Max)
export const DIGITAL_RELEASE_MAX_AGE_DAYS = 365;

// New Release Detection (days)
export const NEW_RELEASE_WINDOW_DAYS = 14;

// Recent Episode Detection (days) — for "New Episodes" section
export const RECENT_EPISODE_WINDOW_DAYS = 14;

// TTL / Timeouts (seconds)
export const PRESIGNED_URL_TTL_SECONDS = 300;

export const KNIP_GATE_PROBE = 'unused';
