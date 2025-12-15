import { Injectable } from '@nestjs/common';
import { USER_MEDIA_STATE } from '../../../user-media/domain/entities/user-media-state.entity';
import type { UserMediaState } from '../../../user-media/domain/entities/user-media-state.entity';
import type { MediaType } from '../../../../common/enums/media-type.enum';
import type { ImageDto } from '../../../catalog/presentation/dtos/common.dto';
import { buildCardMeta, extractContinuePoint } from '../domain/selectors';
import { CARD_LIST_CONTEXT, CARD_NEW_RELEASE_WINDOW_DAYS } from '../domain/card.constants';
import type { CardListContext } from '../domain/card.constants';
import type { CardMeta } from '../domain/card.types';

export type MediaSummaryWithCard = {
  id: string;
  type: MediaType;
  title: string;
  slug: string;
  poster: ImageDto | null;
  releaseDate?: Date | null;
  card?: CardMeta;
};

export type UserMediaWithSummary = UserMediaState & { mediaSummary: MediaSummaryWithCard };

export type CatalogItemWithUserState = {
  userState?: UserMediaState | null;
};

/**
 * Enriches media summaries with card metadata (badge + primary CTA).
 */
@Injectable()
export class CardEnrichmentService {
  /**
   * Enriches user media items with `mediaSummary.card`.
   *
   * MVP: computes only user-derived signals (CONTINUE, IN_WATCHLIST).
   *
   * Use `opts.context` to control list-specific behavior (e.g. suppress
   * certain badges in user library, or enforce "continue-first" behavior
   * in continue sections).
   *
   * @param {UserMediaWithSummary[]} items - User media items with media summary
   * @param {{ context?: CardListContext } | undefined} opts - Optional enrichment options
   * @returns {UserMediaWithSummary[]} Enriched items
   */
  enrichUserMedia(
    items: UserMediaWithSummary[],
    opts?: {
      context?: CardListContext;
    },
  ): UserMediaWithSummary[] {
    const ctx = opts?.context ?? CARD_LIST_CONTEXT.DEFAULT;

    return items.map((item) => {
      const continuePoint = extractContinuePoint(item.progress);

      const card = buildCardMeta(
        {
          hasUserEntry: true,
          userState: item.state,
          continuePoint,
          hasNewEpisode: false,
          isNewRelease: false,
          trendDelta: null,
          isTrending: false,
        },
        ctx,
      );

      if (item.state === USER_MEDIA_STATE.PLANNED) {
        card.continue = null;
      }

      return {
        ...item,
        mediaSummary: {
          ...item.mediaSummary,
          card,
        },
      };
    });
  }

  /**
   * Enriches catalog list items with `card` metadata.
   *
   * Global signals:
   * - TRENDING: enabled when `isTrendingContext` is true
   * - NEW_RELEASE: derived from release dates within a fixed window
   *
   * User-derived signals are applied when `userState` exists.
   */
  enrichCatalogItems<
    T extends {
      releaseDate?: Date | null;
      theatricalReleaseDate?: Date | null;
      digitalReleaseDate?: Date | null;
    } & CatalogItemWithUserState,
  >(items: T[], opts: { context: CardListContext; now?: Date }): Array<T & { card: CardMeta }> {
    const now = opts.now ?? new Date();

    return items.map((item) => {
      const userState = item.userState ?? null;

      const continuePoint = extractContinuePoint(userState?.progress ?? null);

      const isNewRelease = this.isNewRelease(
        [item.theatricalReleaseDate, item.digitalReleaseDate, item.releaseDate],
        now,
      );

      const card = buildCardMeta(
        {
          hasUserEntry: Boolean(userState),
          userState: userState?.state ?? null,
          continuePoint,
          hasNewEpisode: false,
          isNewRelease,
          trendDelta: null,
          isTrending: false,
        },
        opts.context,
      );

      if (userState?.state === USER_MEDIA_STATE.PLANNED) {
        card.continue = null;
      }

      return {
        ...item,
        card,
      };
    });
  }

  private isNewRelease(dates: Array<Date | null | undefined>, now: Date): boolean {
    const latest = dates
      .filter((d): d is Date => Boolean(d))
      .reduce<Date | null>((acc, d) => (!acc || d > acc ? d : acc), null);

    if (!latest) return false;
    const diffMs = now.getTime() - latest.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= CARD_NEW_RELEASE_WINDOW_DAYS;
  }
}
