/**
 * Public API for stats module.
 *
 * This is the ONLY entry point for other modules to import from stats.
 *
 * @example
 * // ✅ Correct
 * import { TrendingSyncService } from '../stats/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { TrendingSyncService } from '../stats/application/services/trending-sync.service';
 */

// Application Services
export {
  DropOffService,
  ScoreRecalculationService,
  StatsBackfillService,
  StatsQueryService,
  TrendingSyncService,
} from '../application/services';

// Constants
export { HOMEPAGE_REFRESH_CONFIG, HERO_REFRESH_CONFIG } from '../stats.constants';
