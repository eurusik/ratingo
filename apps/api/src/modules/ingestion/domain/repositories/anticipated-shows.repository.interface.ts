export interface AnticipatedShowEntry {
  tmdbId: number;
  listCount: number;
  rank: number;
}

export interface AnticipatedShowsRefreshQuery {
  minListCount: number;
  syncedBefore: Date;
  limit: number;
}

export interface IAnticipatedShowsRepository {
  replaceSnapshot(shows: readonly AnticipatedShowEntry[], fetchedAt: Date): Promise<void>;
  findMissingTmdbIds(minListCount: number): Promise<number[]>;
  findTmdbIdsToRefresh(query: AnticipatedShowsRefreshQuery): Promise<number[]>;
  findLatestFetchedAt(): Promise<Date | null>;
}

export const ANTICIPATED_SHOWS_REPOSITORY = Symbol('ANTICIPATED_SHOWS_REPOSITORY');
