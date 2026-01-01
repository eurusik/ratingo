/**
 * Public API for stats module.
 *
 * This is the ONLY entry point for other modules to import from stats.
 *
 * @example
 * // ✅ Correct
 * import { StatsService } from '../stats/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { StatsService } from '../stats/application/services/stats.service';
 */

// Application Services
export { StatsService } from '../application/services/stats.service';
