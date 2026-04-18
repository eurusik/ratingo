/**
 * Represents user-specific media state.
 */
export interface UserMediaState {
  id: string;
  userId: string;
  mediaItemId: string;
  state: 'watching' | 'completed' | 'planned' | 'dropped' | 'paused' | 'caught_up';
  rating: number | null;
  progress: {
    seasons?: Record<number, number>;
  } | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Defines allowed user media state values.
 */
export const USER_MEDIA_STATE = {
  WATCHING: 'watching',
  COMPLETED: 'completed',
  PLANNED: 'planned',
  DROPPED: 'dropped',
  PAUSED: 'paused',
  CAUGHT_UP: 'caught_up',
} as const;

/**
 * Lists all allowed user media state values.
 */
export const USER_MEDIA_STATE_VALUES: UserMediaState['state'][] = Object.values(USER_MEDIA_STATE);

/**
 * Defines states that belong to watchlist.
 */
export const USER_MEDIA_WATCHLIST_STATES: UserMediaState['state'][] = [USER_MEDIA_STATE.PLANNED];

/**
 * Subset of user media states that are part of watch history.
 */
export type UserMediaHistoryState = 'watching' | 'completed' | 'paused' | 'caught_up';

/**
 * Defines states that belong to watch history.
 */
export const USER_MEDIA_HISTORY_STATES: UserMediaHistoryState[] = [
  USER_MEDIA_STATE.WATCHING,
  USER_MEDIA_STATE.COMPLETED,
  USER_MEDIA_STATE.PAUSED,
  USER_MEDIA_STATE.CAUGHT_UP,
];
