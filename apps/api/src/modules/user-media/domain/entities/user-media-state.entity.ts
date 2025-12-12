/**
 * User-specific media state.
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

export const USER_MEDIA_STATE = {
  WATCHING: 'watching',
  COMPLETED: 'completed',
  PLANNED: 'planned',
  DROPPED: 'dropped',
} as const;

export const USER_MEDIA_STATE_VALUES: UserMediaState['state'][] = Object.values(USER_MEDIA_STATE);
