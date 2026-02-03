import { Inject, Injectable } from '@nestjs/common';

import { getBestRating, isNewRelease } from '../../../../common/utils/media.utils';
import { CARD_LIST_CONTEXT } from '../../../shared/cards/domain/card.constants';
import { isHitQuality } from '../../../shared/cards/domain/quality.utils';
import { buildCardMeta, extractContinuePoint } from '../../../shared/cards/domain/selectors';
import { CLOCK_PORT, type IClockPort } from '../../../shared/clock';
import { MovieVerdictService } from '../../../shared/verdict';
import { mapBadgeToPopularitySignal } from '../../../shared/verdict/domain/popularity-signal';
import { MovieNotFoundError } from '../../domain/errors';
import {
  type IMovieRepository,
  MOVIE_REPOSITORY,
  type MovieDetails,
} from '../../domain/repositories/movie.repository.interface';
import type { EnrichedMovieDetails } from '../../domain/types';
import { computeReleaseStatus } from '../../domain/utils/release-status.utils';

import { CatalogUserStateEnricher } from './catalog-userstate-enricher.service';

/**
 * Application service for movie details operations.
 * Orchestrates fetching, enrichment, and business logic computation.
 */
@Injectable()
export class MovieDetailsService {
  constructor(
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
    private readonly userStateEnricher: CatalogUserStateEnricher,
    private readonly verdictService: MovieVerdictService,
  ) {}

  /**
   * Fetches movie details by slug and enriches with user state, card, and verdict.
   *
   * @throws MovieNotFoundError if movie not found
   */
  async getBySlug(slug: string, userId?: string | null): Promise<EnrichedMovieDetails> {
    const movie = await this.movieRepository.findBySlug(slug);

    if (!movie) {
      throw new MovieNotFoundError(slug);
    }

    const enriched = await this.userStateEnricher.enrichOne(userId, {
      ...movie,
      userState: null,
    });

    const card = this.buildCard(movie, enriched.userState);
    const now = this.clock.now();

    const releaseStatus = computeReleaseStatus(
      movie.releaseDate,
      movie.theatricalReleaseDate,
      movie.digitalReleaseDate,
      now,
    );

    const verdict = this.computeVerdict(movie, releaseStatus, card);

    return {
      ...enriched,
      card,
      releaseStatus,
      verdict,
    };
  }

  private buildCard(
    movie: MovieDetails,
    userState: EnrichedMovieDetails['userState'],
  ): EnrichedMovieDetails['card'] {
    return buildCardMeta(
      {
        hasUserEntry: Boolean(userState),
        userState: userState?.state ?? null,
        continuePoint: extractContinuePoint(userState?.progress ?? null),
        hasNewEpisode: false,
        isNewRelease: isNewRelease(movie.releaseDate),
        isHit: isHitQuality(movie.externalRatings),
        trendDelta: null,
        isTrending: false,
      },
      CARD_LIST_CONTEXT.DEFAULT,
    );
  }

  private computeVerdict(
    movie: MovieDetails,
    releaseStatus: EnrichedMovieDetails['releaseStatus'],
    card: EnrichedMovieDetails['card'],
  ): EnrichedMovieDetails['verdict'] {
    const { rating: bestRating, source: bestRatingSource } = getBestRating(movie.externalRatings);

    return this.verdictService.compute({
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
