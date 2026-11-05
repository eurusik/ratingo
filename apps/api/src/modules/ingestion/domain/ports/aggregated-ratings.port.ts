import { type MediaType } from '../../../../common/enums/media-type.enum';

export interface AggregatedRatings {
  imdbRating: number | null;
  imdbVotes: number | null;
  rottenTomatoes: number | null;
  metacritic: number | null;
  metascore: number | null;
}

export interface AggregatedRatingsPort {
  getAggregatedRatings(imdbId: string, type: MediaType): Promise<AggregatedRatings>;
}

export const AGGREGATED_RATINGS_PORT = Symbol('AGGREGATED_RATINGS_PORT');
