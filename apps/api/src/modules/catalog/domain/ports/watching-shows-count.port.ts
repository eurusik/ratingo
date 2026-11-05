export interface IWatchingShowsCountPort {
  countWatchingShows(userId: string): Promise<number>;
}

export const WATCHING_SHOWS_COUNT_PORT = Symbol('WATCHING_SHOWS_COUNT_PORT');
