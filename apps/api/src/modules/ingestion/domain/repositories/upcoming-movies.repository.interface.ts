export interface UpcomingMoviesRefreshQuery {
  releasedAfter: Date;
  releasedBefore: Date | null;
  syncedBefore: Date;
  limit: number;
}

export interface IUpcomingMoviesRepository {
  findTmdbIdsToRefresh(query: UpcomingMoviesRefreshQuery): Promise<number[]>;
}

export const UPCOMING_MOVIES_REPOSITORY = Symbol('UPCOMING_MOVIES_REPOSITORY');
