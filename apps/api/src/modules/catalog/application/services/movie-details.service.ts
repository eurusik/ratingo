import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IMovieRepository,
  MOVIE_REPOSITORY,
  MovieDetails,
} from '../../domain/repositories/movie.repository.interface';
import { CatalogUserStateEnricher } from './catalog-userstate-enricher.service';
import { BADGE_KEY, CARD_LIST_CONTEXT } from '../../../shared/cards/domain/card.constants';
import { buildCardMeta, extractContinuePoint } from '../../../shared/cards/domain/selectors';
import { isHitQuality } from '../../../shared/cards/domain/quality.utils';
import { computeReleaseStatus } from '../../domain/utils/release-status.utils';
import { computeMovieVerdict, MovieVerdict } from '../../../shared/verdict';
import {
  POPULARITY_SIGNAL,
  PopularitySignal,
} from '../../../shared/verdict/domain/popularity-signal';
import { ReleaseStatus } from '../../../../common/enums/release-status.enum';
import { getBestRating, isNewRelease } from '../../../../common/utils/media.utils';
import type { UserMediaState } from '../../../user-media/domain/entities/user-media-state.entity';
import type { CardMeta, BadgeKey } from '../../../shared/cards/domain/card.types';

/**
 * Maps card badge key to verdict popularity signal.
 */
function mapBadgeToPopularitySignal(badgeKey: BadgeKey | null | undefined): PopularitySignal {
  if (badgeKey === BADGE_KEY.TRENDING) return POPULARITY_SIGNAL.TRENDING;
  if (badgeKey === BADGE_KEY.HIT) return POPULARITY_SIGNAL.HIT;
  if (badgeKey === BADGE_KEY.RISING) return POPULARITY_SIGNAL.RISING;
  return null;
}

/**
 * Result of movie details enrichment.
 */
export interface EnrichedMovieDetails extends MovieDetails {
  userState: UserMediaState | null;
  card: CardMeta | null;
  releaseStatus: ReleaseStatus;
  verdict: MovieVerdict;
}

/**
 * Application service for movie details operations.
 * Orchestrates fetching, enrichment, and business logic computation.
 */
@Injectable()
export class MovieDetailsService {
  constructor(
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    private readonly userStateEnricher: CatalogUserStateEnricher,
  ) {}

  /**
   * Fetches movie details by slug and enriches with user state, card, and verdict.
   *
   * @param slug - Movie slug
   * @param userId - Optional user ID for personalization
   * @returns Enriched movie details
   * @throws NotFoundException if movie not found
   */
  async getBySlug(slug: string, userId?: string | null): Promise<EnrichedMovieDetails> {
    const movie = await this.movieRepository.findBySlug(slug);

    if (!movie) {
      throw new NotFoundException(`Movie with slug "${slug}" not found`);
    }

    // Enrich with user state
    const enriched = await this.userStateEnricher.enrichOne(userId, {
      ...movie,
      userState: null,
    });

    // Build card metadata
    const card = this.buildCard(movie, enriched.userState);

    // Compute release status
    const releaseStatus = computeReleaseStatus(
      movie.releaseDate,
      movie.theatricalReleaseDate,
      movie.digitalReleaseDate,
    );

    // Compute verdict
    const verdict = this.computeVerdict(movie, releaseStatus, card);

    return {
      ...enriched,
      card,
      releaseStatus,
      verdict,
    };
  }

  /**
   * Builds card metadata for movie details page.
   */
  private buildCard(movie: MovieDetails, userState: UserMediaState | null): CardMeta | null {
    return buildCardMeta(
      {
        hasUserEntry: Boolean(userState),
        userState: userState?.state ?? null,
        continuePoint: extractContinuePoint(userState?.progress ?? null),
        hasNewEpisode: false, // Movies don't have episodes
        isNewRelease: isNewRelease(movie.releaseDate),
        isHit: isHitQuality(movie.externalRatings),
        trendDelta: null,
        isTrending: false,
      },
      CARD_LIST_CONTEXT.DEFAULT,
    );
  }

  /**
   * Computes verdict for movie details page.
   */
  private computeVerdict(
    movie: MovieDetails,
    releaseStatus: ReleaseStatus,
    card: CardMeta | null,
  ): MovieVerdict {
    const { rating: bestRating, source: bestRatingSource } = getBestRating(movie.externalRatings);

    return computeMovieVerdict({
      releaseStatus,
      ratingoScore: movie.stats?.ratingoScore ?? null,
      avgRating: bestRating?.rating ?? null,
      voteCount: bestRating?.voteCount ?? null,
      ratingSource: bestRatingSource,
      popularitySignal: mapBadgeToPopularitySignal(card?.badgeKey),
      popularity: movie.stats?.popularityScore ?? null,
      releaseDate: movie.releaseDate ?? null,
    });
  }
}
