/**
 * Результат пошуку related TMDB ID
 */
export interface RelatedResult {
  /** Масив знайдених TMDB ID */
  ids: number[];
  /** Джерело рекомендацій - Trakt або TMDB */
  source: 'trakt' | 'tmdb';
}

/**
 * Related show з Trakt API
 */
export interface TraktRelatedShow {
  /** Ідентифікатори show */
  ids?: {
    /** TMDB ID */
    tmdb?: number;
  };
}

/**
 * Рекомендація з TMDB API
 */
export interface TmdbRecommendation {
  /** TMDB ID */
  id?: number;
  /** Масив ID жанрів */
  genre_ids?: number[];
}

/**
 * Відповідь TMDB API з рекомендаціями
 */
export interface TmdbRecommendationsResponse {
  /** Масив рекомендацій */
  results?: TmdbRecommendation[];
}
