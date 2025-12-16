import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageDto, RatingoStatsDto, ExternalRatingsDto } from '../../presentation/dtos/common.dto';

/**
 * Show progress information for hero items.
 */
export interface HeroShowProgress {
  season: number | null;
  episode: number | null;
  label: string | null;
  lastAirDate: Date | null;
  nextAirDate: Date | null;
}

/**
 * Hero media item for homepage showcase.
 */
export interface HeroMediaItem {
  id: string;
  mediaItemId: string;
  type: MediaType;
  slug: string;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  primaryTrailerKey: string | null;
  poster: ImageDto | null;
  backdrop: ImageDto | null;
  releaseDate: Date | null;
  isNew: boolean;
  isClassic: boolean;
  stats: RatingoStatsDto;
  externalRatings: Pick<ExternalRatingsDto, 'tmdb'>;
  showProgress?: HeroShowProgress | null;
}

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
