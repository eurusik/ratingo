import { type MediaType } from '../../../../common/enums/media-type.enum';

/**
 * Search result item from local database.
 */
export interface LocalSearchResult {
  id: string;
  tmdbId: number;
  type: MediaType;
  title: string;
  originalTitle: string | null;
  slug: string;
  posterPath: string | null;
  rating: number;
  releaseDate: Date | null;
  ingestionStatus: string;
}
