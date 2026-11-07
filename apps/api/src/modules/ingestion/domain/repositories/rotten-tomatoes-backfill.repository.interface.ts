import { type MediaType } from '@/common/enums/media-type.enum';

import { type RottenTomatoesRatings } from '../ports/rotten-tomatoes-ratings.port';

import { type BackfillPage } from './backfill-page.interface';

export interface RottenTomatoesBackfillCandidate {
  id: string;
  tmdbId: number | null;
  type: MediaType;
}

export interface RottenTomatoesFetchResult {
  fetchedAt: Date;
  ratings: RottenTomatoesRatings;
  ratingsChangedAt: Date | null;
}

export interface IRottenTomatoesBackfillRepository {
  findCandidates(
    page: BackfillPage & { fetchedBefore: Date },
  ): Promise<RottenTomatoesBackfillCandidate[]>;
  findLastFetchedAt(mediaItemId: string): Promise<Date | null>;
  saveFetchResult(mediaItemId: string, result: RottenTomatoesFetchResult): Promise<void>;
}

export const ROTTEN_TOMATOES_BACKFILL_REPOSITORY = Symbol('ROTTEN_TOMATOES_BACKFILL_REPOSITORY');
