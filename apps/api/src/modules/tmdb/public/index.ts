/**
 * Public API for tmdb module.
 *
 * This is the ONLY entry point for other modules to import from tmdb.
 *
 * @example
 * // ✅ Correct
 * import { TmdbAdapter } from '../tmdb/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { TmdbAdapter } from '../tmdb/tmdb.adapter';
 */

export { ALT_TITLE_COUNTRIES, MAX_ALT_TITLES } from '../constants/alt-title.constants';
export { TmdbAdapter } from '../tmdb.adapter';
export type { PersonDetails } from '../types/person.types';
