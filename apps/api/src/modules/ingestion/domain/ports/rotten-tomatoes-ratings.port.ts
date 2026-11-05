import { type MediaType } from '../../../../common/enums/media-type.enum';

export interface RottenTomatoesRatings {
  rottenTomatoesCritics: number | null;
  rottenTomatoesAudience: number | null;
}

export interface RottenTomatoesRatingsPort {
  isConfigured(): boolean;
  getRottenTomatoesRatings(tmdbId: number, type: MediaType): Promise<RottenTomatoesRatings>;
}

export const ROTTEN_TOMATOES_RATINGS_PORT = Symbol('ROTTEN_TOMATOES_RATINGS_PORT');
