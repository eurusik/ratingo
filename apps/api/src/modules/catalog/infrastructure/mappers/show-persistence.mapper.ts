import { type InferInsertModel } from 'drizzle-orm';

import type * as schema from '../../../../database/schema';
import type { NormalizedMedia } from '../../../ingestion/public';
import { pickDefined } from '../utils/persistence.utils';

/** Show-specific details from NormalizedMedia.details */
type ShowDetails = NonNullable<NormalizedMedia['details']>;

/**
 * Maps NormalizedMedia.details to Drizzle insert/update payloads for shows table.
 */
export class ShowPersistenceMapper {
  static toShowInsert(
    mediaId: string,
    details: ShowDetails,
  ): InferInsertModel<typeof schema.shows> {
    return {
      mediaItemId: mediaId,
      totalSeasons: details.totalSeasons,
      totalEpisodes: details.totalEpisodes,
      lastAirDate: details.lastAirDate,
      nextAirDate: details.nextAirDate,
      status: details.status,
    };
  }

  static toShowUpdate(details: ShowDetails): Partial<InferInsertModel<typeof schema.shows>> {
    const update = pickDefined({
      totalSeasons: details.totalSeasons,
      totalEpisodes: details.totalEpisodes,
      lastAirDate: details.lastAirDate,
      nextAirDate: details.nextAirDate,
      status: details.status,
    });
    // Ensure at least one field for upsert
    if (Object.keys(update).length === 0) {
      return { totalSeasons: null };
    }
    return update;
  }
}
