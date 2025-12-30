import type { UserMediaState } from '../../../user-media/domain/entities/user-media-state.entity';

/**
 * Base type for items that can be enriched with user state.
 */
export type WithUserState<T> = T & {
  id: string;
  userState?: UserMediaState | null;
};

/**
 * Item with required id for enrichment operations.
 */
export interface Identifiable {
  id: string;
}
