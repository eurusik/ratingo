import { Inject, Injectable } from '@nestjs/common';

import { hasRecentEpisode, isNewRelease } from '../../../../common/utils/media.utils';
import { CARD_LIST_CONTEXT } from '../../../shared/cards/domain/card.constants';
import { isHitQuality } from '../../../shared/cards/domain/quality.utils';
import { buildCardMeta, extractContinuePoint } from '../../../shared/cards/domain/selectors';
import { computeShowVerdict } from '../../../shared/verdict';
import { mapBadgeToPopularitySignal } from '../../../shared/verdict/domain/popularity-signal';
import { ShowNotFoundError } from '../../domain/errors';
import {
  type IShowRepository,
  SHOW_REPOSITORY,
  type ShowDetails,
} from '../../domain/repositories/show.repository.interface';
import type { EnrichedShowDetails } from '../../domain/types/show-details.types';

import { CatalogUserStateEnricher } from './catalog-userstate-enricher.service';

/**
 * Application service for show details operations.
 * Orchestrates fetching, enrichment, and business logic computation.
 */
@Injectable()
export class ShowDetailsService {
  constructor(
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    private readonly userStateEnricher: CatalogUserStateEnricher,
  ) {}

  /**
   * Fetches show details by slug and enriches with user state, card, and verdict.
   *
   * @throws ShowNotFoundError if show not found
   */
  async getBySlug(slug: string, userId?: string | null): Promise<EnrichedShowDetails> {
    const show = await this.showRepository.findBySlug(slug);

    if (!show) {
      throw new ShowNotFoundError(slug);
    }

    const enriched = await this.userStateEnricher.enrichOne(userId, {
      ...show,
      userState: null,
    });

    const card = this.buildCard(show, enriched.userState);
    const { verdict, statusHint } = this.computeVerdict(show, card);

    return {
      ...enriched,
      card,
      verdict,
      statusHint,
    };
  }

  private buildCard(
    show: ShowDetails,
    userState: EnrichedShowDetails['userState'],
  ): EnrichedShowDetails['card'] {
    return buildCardMeta(
      {
        hasUserEntry: Boolean(userState),
        userState: userState?.state ?? null,
        continuePoint: extractContinuePoint(userState?.progress ?? null),
        hasNewEpisode: hasRecentEpisode(show.nextAirDate),
        isNewRelease: isNewRelease(show.releaseDate),
        isHit: isHitQuality(show.externalRatings),
        trendDelta: null,
        isTrending: false,
      },
      CARD_LIST_CONTEXT.DEFAULT,
    );
  }

  private computeVerdict(
    show: ShowDetails,
    card: EnrichedShowDetails['card'],
  ): { verdict: EnrichedShowDetails['verdict']; statusHint: EnrichedShowDetails['statusHint'] } {
    return computeShowVerdict({
      status: show.status,
      externalRatings: show.externalRatings,
      popularitySignal: mapBadgeToPopularitySignal(card?.badgeKey),
      popularity: show.stats?.popularityScore ?? null,
      totalSeasons: show.totalSeasons,
      lastAirDate: show.lastAirDate,
      firstAirDate: show.releaseDate ?? null,
    });
  }
}
