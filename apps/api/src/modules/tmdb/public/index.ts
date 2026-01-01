/**
 * Public API for tmdb module.
 *
 * This is the ONLY entry point for other modules to import from tmdb.
 *
 * @example
 * // ✅ Correct
 * import { TmdbAdapter, TmdbModule } from '../tmdb/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { TmdbAdapter } from '../tmdb/tmdb.adapter';
 */

export { TmdbAdapter } from '../tmdb.adapter';
export { TmdbModule } from '../tmdb.module';
