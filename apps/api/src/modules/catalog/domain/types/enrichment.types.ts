import type { UserState } from '../ports/user-state-provider.port';

/**
 * Base type for items that can be enriched with user state.
 */
export type WithUserState<T> = T & {
  id: string;
  userState?: UserState | null;
};

/**
 * Item with required id for enrichment operations.
 */
export interface Identifiable {
  id: string;
}
