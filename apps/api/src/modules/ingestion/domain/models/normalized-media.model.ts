import { MediaType } from '@/common/enums/media-type.enum';

/**
 * Represents the "Clean" data structure used internally by our system.
 * All external API responses must be converted to this format before processing.
 */
export interface NormalizedMedia {
  externalIds: {
    tmdbId: number;
    imdbId?: string | null;
    traktId?: number | null;
  };

  type: MediaType;
  title: string;
  originalTitle?: string | null;
  overview?: string | null;
  
  /** Generated SEO-friendly slug */
  slug: string;

  posterPath?: string | null;
  backdropPath?: string | null;

  /** Normalized 0-10 scale */
  rating: number;
  voteCount: number;
  popularity: number;
  
  // External Ratings (Optional)
  ratingImdb?: number | null;
  voteCountImdb?: number | null;
  ratingMetacritic?: number | null;
  ratingRottenTomatoes?: number | null;
  ratingTrakt?: number | null;
  voteCountTrakt?: number | null;
  
  /** Synthetic score for sorting trending lists. Null if not in trends. */
  trendingScore?: number;

  /** First air date for shows */
  releaseDate?: Date | null;
  status?: string | null;
  isAdult: boolean;

  details?: {
    runtime?: number | null;
    budget?: number | null;
    revenue?: number | null;
    
    totalSeasons?: number | null;
    totalEpisodes?: number | null;
    lastAirDate?: Date | null;
  };

  genres: Array<{
    tmdbId: number;
    name: string;
    slug: string;
  }>;

  watchProviders?: Array<{
    providerId: number; // TMDB Provider ID
    name: string;
    logoPath?: string | null;
    type: string; // 'flatrate' | 'buy' | 'rent'
    displayPriority?: number;
  }>;
}
