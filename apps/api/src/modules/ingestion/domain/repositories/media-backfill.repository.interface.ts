import { type MediaType } from '../../../../common/enums/media-type.enum';
import { type RottenTomatoesRatings } from '../ports/rotten-tomatoes-ratings.port';

export interface RtBackfillCandidate {
  id: string;
  tmdbId: number | null;
  type: MediaType;
}

export interface AltTitlesBackfillCandidate {
  id: string;
  tmdbId: number | null;
  type: MediaType;
  title: string;
  originalTitle: string | null;
}

export interface ImdbBackfillCandidate {
  id: string;
  tmdbId: number | null;
}

export interface IMediaBackfillRepository {
  findRtBackfillCandidates(
    staleBefore: Date,
    cursor: string | undefined,
    limit: number,
  ): Promise<RtBackfillCandidate[]>;

  findRtFetchedAt(mediaItemId: string, tmdbId: number): Promise<Date | null>;

  markRtFetched(mediaItemId: string, tmdbId: number, ratings: RottenTomatoesRatings): Promise<void>;

  findAltTitlesBackfillCandidates(
    cursor: string | undefined,
    limit: number,
  ): Promise<AltTitlesBackfillCandidate[]>;

  findShowsMissingImdbId(
    cursor: string | undefined,
    limit: number,
  ): Promise<ImdbBackfillCandidate[]>;

  setShowImdbId(tmdbId: number, imdbId: string): Promise<void>;
}

export const MEDIA_BACKFILL_REPOSITORY = Symbol('MEDIA_BACKFILL_REPOSITORY');
