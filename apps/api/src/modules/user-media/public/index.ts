/**
 * Public API for user-media module.
 *
 * This is the ONLY entry point for other modules to import from user-media.
 *
 * @example
 * // ✅ Correct
 * import { UserMediaService, USER_MEDIA_STATE } from '../user-media/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { UserMediaService } from '../user-media/application/user-media.service';
 */

// Domain entities
export {
  USER_MEDIA_STATE,
  USER_MEDIA_STATE_VALUES,
  USER_MEDIA_HISTORY_STATES,
  USER_MEDIA_WATCHLIST_STATES,
} from '../domain/entities/user-media-state.entity';
export type { UserMediaState } from '../domain/entities/user-media-state.entity';

// Domain events
export { UserMediaRatingChangedEvent } from '../domain/events/user-media-rating-changed.event';
export { UserMediaStateChangedEvent } from '../domain/events/user-media-state-changed.event';

// Ports
export { RATING_SYNC_PORT } from '../domain/ports/rating-sync.port';
export type { IRatingSyncPort } from '../domain/ports/rating-sync.port';

// Application services
export { UserMediaService } from '../application/user-media.service';
export { ResolveImportDispatcherPipeline } from '../application/pipelines/resolve-import-dispatcher.pipeline';
export { ResolveImportItemPipeline } from '../application/pipelines/resolve-import-item.pipeline';
