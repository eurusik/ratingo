export const SHOW_STATUS_PORT = Symbol('SHOW_STATUS_PORT');

/**
 * Port for querying show airing status.
 * Used by EpisodeProgressService to decide between caught_up and completed.
 */
export interface IShowStatusPort {
  /** Returns true if the show is still airing (Returning Series, In Production). */
  isOngoing(showId: string): Promise<boolean>;
}
