import { type MediaType } from '../../../../common/enums/media-type.enum';

/**
 * Port for syncing rating to the user-media state aggregate.
 *
 * Defined in the reviews domain so that ReviewsService can depend
 * on an abstraction without coupling to user-media internals.
 *
 * The optional `mediaType` allows the implementing adapter to pick
 * the correct default state (`watching` for shows, `completed` for
 * movies) when no user-media state exists yet.
 */
export interface IRatingSyncPort {
  syncRating(
    userId: string,
    mediaItemId: string,
    rating: number,
    mediaType?: MediaType,
  ): Promise<void>;
}

/**
 * Injection token for the rating sync port.
 */
export const RATING_SYNC_PORT = Symbol('RATING_SYNC_PORT');
