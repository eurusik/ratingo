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
