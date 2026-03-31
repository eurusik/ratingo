/**
 * User state for a media item.
 * Defined locally to avoid cross-bounded context domain dependency.
 */
export interface UserState {
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
 * Port for retrieving user-specific media state.
 * Follows Interface Segregation - only methods needed by catalog module.
 */
export interface IUserStateProvider {
  /**
   * Gets user state for a single media item.
   */
  getState(userId: string, mediaItemId: string): Promise<UserState | null>;

  /**
   * Gets user states for multiple media items in batch.
   */
  findMany(userId: string, mediaItemIds: string[]): Promise<UserState[]>;
}

/**
 * Injection token for user state provider.
 */
export const USER_STATE_PROVIDER = Symbol('USER_STATE_PROVIDER');
