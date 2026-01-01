import { type MediaType } from '../enums/media-type.enum';

import { type ImageData, type ExternalRatings, type RatingoStats } from './media.types';

// Re-export for backward compatibility
export type { ImageData, ExternalRatings, RatingoStats } from './media.types';
export type { ExternalRating } from './media.types';

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
 * Shared type used by both catalog (producer) and home (consumer) modules.
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
