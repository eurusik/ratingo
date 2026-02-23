/**
 * Countries whose alternative titles are indexed for search.
 * Intentionally limited to primary markets to reduce DB bloat.
 * Origin countries of each title are also dynamically included at extraction time.
 */
export const ALT_TITLE_COUNTRIES = new Set(['UA', 'US', 'RU', 'GB']);

/** Maximum alternative titles stored per media item */
export const MAX_ALT_TITLES = 20;
