/**
 * Represents user-specific media state.
 */
export interface UserMediaState {
  id: string;
  userId: string;
  mediaItemId: string;
  state: 'watching' | 'completed' | 'planned' | 'dropped';
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
 * Defines states that belong to watch history.
 */
export const USER_MEDIA_HISTORY_STATES: UserMediaState['state'][] = [
  USER_MEDIA_STATE.WATCHING,
  USER_MEDIA_STATE.COMPLETED,
];
