import { Injectable } from '@nestjs/common';
import { UserMediaService } from '../../../user-media/application/user-media.service';
import type { UserMediaState } from '../../../user-media/domain/entities/user-media-state.entity';

type WithId<T> = T & { id: string; userState?: UserMediaState | null };

/**
 * Application-level enricher for attaching user-specific media state.
 * Avoids pushing user logic into repositories.
 */
@Injectable()
export class CatalogUserStateEnricher {
  constructor(private readonly userMediaService: UserMediaService) {}

  /**
   * Enriches a list of items with userState in one batch (no N+1).
   */
  async enrichList<T extends { id: string }>(
    userId: string | null | undefined,
    items: WithId<T>[],
  ): Promise<WithId<T>[]> {
    if (!userId || !items.length) {
      return items.map((i) => ({ ...i, userState: null }));
    }

    const ids = items.map((i) => i.id);
    const states = await this.userMediaService.findMany(userId, ids);
    const map = new Map(states.map((s) => [s.mediaItemId, s]));

    return items.map((item) => ({
      ...item,
      userState: map.get(item.id) || null,
    }));
  }

  /**
   * Enriches a single item with userState.
   */
  async enrichOne<T extends { id: string }>(
    userId: string | null | undefined,
    item: WithId<T>,
  ): Promise<WithId<T>> {
    if (!userId) {
      return { ...item, userState: null };
    }
    const state = await this.userMediaService.getState(userId, item.id);
    return { ...item, userState: state || null };
  }
}
