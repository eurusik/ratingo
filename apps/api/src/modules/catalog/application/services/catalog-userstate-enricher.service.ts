import { Inject, Injectable } from '@nestjs/common';

import {
  IUserStateProvider,
  USER_STATE_PROVIDER,
} from '../../domain/ports/user-state-provider.port';
import type { Identifiable, WithUserState } from '../../domain/types/enrichment.types';

/**
 * Application-level enricher for attaching user-specific media state.
 * Avoids pushing user logic into repositories.
 */
@Injectable()
export class CatalogUserStateEnricher {
  constructor(
    @Inject(USER_STATE_PROVIDER)
    private readonly userStateProvider: IUserStateProvider,
  ) {}

  /**
   * Enriches a list of items with userState in one batch (no N+1).
   */
  async enrichList<T extends Identifiable>(
    userId: string | null | undefined,
    items: WithUserState<T>[],
  ): Promise<WithUserState<T>[]> {
    if (!userId || !items.length) {
      return items.map((i) => ({ ...i, userState: null }));
    }

    const ids = items.map((i) => i.id);
    const states = await this.userStateProvider.findMany(userId, ids);
    const map = new Map(states.map((s) => [s.mediaItemId, s]));

    return items.map((item) => ({
      ...item,
      userState: map.get(item.id) || null,
    }));
  }

  /**
   * Enriches a list of plain items (without pre-attached userState) with user state.
   * Convenience wrapper that initializes userState before enrichment.
   */
  async enrichItemList<T extends Identifiable>(
    userId: string | null | undefined,
    items: T[],
  ): Promise<WithUserState<T>[]> {
    const withState = items.map((i) => ({ ...i, userState: null }));
    return this.enrichList(userId, withState);
  }

  /**
   * Enriches a single item with userState.
   */
  async enrichOne<T extends Identifiable>(
    userId: string | null | undefined,
    item: WithUserState<T>,
  ): Promise<WithUserState<T>> {
    if (!userId) {
      return { ...item, userState: null };
    }
    const state = await this.userStateProvider.getState(userId, item.id);
    return { ...item, userState: state || null };
  }
}
