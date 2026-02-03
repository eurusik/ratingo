import { type InferInsertModel } from 'drizzle-orm';

import type * as schema from '../../../../database/schema';
import type { NormalizedMedia } from '../../../ingestion/public';
import { pickDefined } from '../utils/persistence.utils';

/** Movie-specific details from NormalizedMedia.details */
type MovieDetails = NonNullable<NormalizedMedia['details']>;

/**
 * Maps NormalizedMedia.details to Drizzle insert/update payloads for movies table.
 */
export class MoviePersistenceMapper {
  static toMovieInsert(
    mediaId: string,
    details: MovieDetails,
  ): InferInsertModel<typeof schema.movies> {
    return {
      mediaItemId: mediaId,
      runtime: details.runtime,
      budget: details.budget,
      revenue: details.revenue,
      status: details.status,
      theatricalReleaseDate: details.theatricalReleaseDate,
      digitalReleaseDate: details.digitalReleaseDate,
      releases: details.releases,
    };
  }

  static toMovieUpdate(details: MovieDetails): Partial<InferInsertModel<typeof schema.movies>> {
    const update = pickDefined({
      runtime: details.runtime,
      budget: details.budget,
      revenue: details.revenue,
      status: details.status,
      theatricalReleaseDate: details.theatricalReleaseDate,
      digitalReleaseDate: details.digitalReleaseDate,
      releases: details.releases,
    });
    // Ensure at least one field for upsert
    if (Object.keys(update).length === 0) {
      return { runtime: null };
    }
    return update;
  }
}
