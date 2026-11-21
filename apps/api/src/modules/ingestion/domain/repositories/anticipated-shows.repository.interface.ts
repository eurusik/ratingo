import { type AnticipatedShowRanking } from '@/modules/trakt/public';

export interface AnticipatedShowsImportQuery {
  minListCount: number;
  limit: number;
}

export interface AnticipatedShowsRefreshQuery {
  minListCount: number;
  syncedBefore: Date;
  limit: number;
}

export interface IAnticipatedShowsRepository {
  replaceSnapshot(shows: readonly AnticipatedShowRanking[], fetchedAt: Date): Promise<void>;
  findMissingTmdbIds(query: AnticipatedShowsImportQuery): Promise<number[]>;
  findTmdbIdsToRefresh(query: AnticipatedShowsRefreshQuery): Promise<number[]>;
  findLatestFetchedAt(): Promise<Date | null>;
}

export const ANTICIPATED_SHOWS_REPOSITORY = Symbol('ANTICIPATED_SHOWS_REPOSITORY');
