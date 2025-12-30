import { MediaType } from '../../../../common/enums/media-type.enum';
import type { ImageData, RatingoStats, ExternalRatings } from '../types/common.types';

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
 * Domain model representing high-quality content for hero section.
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
  poster: ImageData | null;
  backdrop: ImageData | null;
  releaseDate: Date | null;
  isNew: boolean;
  isClassic: boolean;
  stats: RatingoStats;
  externalRatings: ExternalRatings;
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
