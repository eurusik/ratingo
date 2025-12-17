import {
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
  Param,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  IShowRepository,
  SHOW_REPOSITORY,
  CalendarEpisode,
  ShowDetails,
} from '../../domain/repositories/show.repository.interface';
import { TrendingShowsQueryDto, TrendingShowsResponseDto } from '../dtos/trending.dto';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { CalendarResponseDto } from '../dtos/calendar-response.dto';
import { ShowResponseDto } from '../dtos/show-response.dto';
import { DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { CardEnrichmentService } from '../../../shared/cards/application/card-enrichment.service';
import { CARD_LIST_CONTEXT } from '../../../shared/cards/domain/card.constants';
import type { UserMediaState } from '../../../user-media/domain/entities/user-media-state.entity';
import { normalizeListQuery } from '../utils/query-normalizer';
import { buildCardMeta, extractContinuePoint } from '../../../shared/cards/domain/selectors';
import { isHitQuality } from '../../../shared/cards/domain/quality.utils';
import { computeShowVerdict, RATING_SOURCE } from '../../../shared/verdict';

/**
 * Public show catalog endpoints (trending, calendar, details).
 */
@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@Controller('catalog/shows')
export class CatalogShowsController {
  private static readonly DEFAULT_CALENDAR_DAYS = 7;
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly DEFAULT_OFFSET = 0;

  /**
   * Public show catalog endpoints (trending, calendar, details).
   */
  constructor(
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    private readonly userStateEnricher: CatalogUserStateEnricher,
    private readonly cards: CardEnrichmentService,
  ) {}

  /**
   * Returns trending shows list with pagination.
   *
   * @param {TrendingShowsQueryDto} query - Query params
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<TrendingShowsResponseDto>} Trending shows response
   */
  @Get('trending')
  @ApiOperation({
    summary: 'Trending TV shows',
    description: 'Returns trending shows sorted by popularity and rating.',
  })
  @ApiOkResponse({ type: TrendingShowsResponseDto })
  async getTrendingShows(
    @Query() query: TrendingShowsQueryDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<TrendingShowsResponseDto> {
    const normalizedQuery = normalizeListQuery(query);
    const shows = await this.showRepository.findTrending(normalizedQuery);
    const data = await this.catalogUserListEnrich(user, shows);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.TRENDING_LIST,
    });
    const limit = normalizedQuery.limit ?? CatalogShowsController.DEFAULT_LIMIT;
    const offset = normalizedQuery.offset ?? CatalogShowsController.DEFAULT_OFFSET;
    const total = shows.total ?? shows.length;

    return {
      data: withCards,
      meta: {
        count: shows.length,
        total,
        limit,
        offset,
        hasMore: offset + shows.length < total,
      },
    };
  }

  /**
   * Returns show episodes grouped by date within a range.
   *
   * @param {string} startDateString - Start date ISO string
   * @param {number} days - Number of days to include
   * @returns {Promise<CalendarResponseDto>} Calendar response
   */
  @Get('calendar')
  @ApiOperation({
    summary: 'Global release calendar for TV shows',
    description: 'Returns episodes airing within the specified date range. Groups episodes by day.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO string). Default: today.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to include (default: 7).',
  })
  @ApiOkResponse({ type: CalendarResponseDto })
  async getCalendar(
    @Query('startDate') startDateString?: string,
    @Query('days', new DefaultValuePipe(CatalogShowsController.DEFAULT_CALENDAR_DAYS), ParseIntPipe)
    days?: number,
  ): Promise<CalendarResponseDto> {
    const start = startDateString ? new Date(startDateString) : new Date();
    if (startDateString && Number.isNaN(start.getTime())) {
      throw new BadRequestException('startDate must be a valid ISO date string');
    }

    const end = new Date(start);
    const daysToAdd =
      typeof days === 'number' && !Number.isNaN(days)
        ? days
        : CatalogShowsController.DEFAULT_CALENDAR_DAYS;

    if (daysToAdd < 0) {
      throw new BadRequestException('days must be greater than or equal to 0');
    }
    end.setDate(end.getDate() + daysToAdd);

    const episodes = await this.showRepository.findEpisodesByDateRange(start, end);

    const grouped = this.groupEpisodesByDate(episodes);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      days: grouped,
    };
  }

  /**
   * Returns show details by slug.
   *
   * @param {string} slug - Show slug
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<ShowResponseDto>} Show details
   */
  @Get(':slug')
  @ApiOperation({
    summary: 'Get show details by slug',
    description: 'Returns full show details including seasons list.',
  })
  @ApiOkResponse({ type: ShowResponseDto })
  async getShowBySlug(@Param('slug') slug: string, @CurrentUser() user?: { id: string } | null) {
    const show = await this.showRepository.findBySlug(slug);
    if (!show) {
      throw new NotFoundException(`Show with slug "${slug}" not found`);
    }
    const enriched = await this.catalogUserOneEnrich(user, show);

    // Build card metadata for details page
    const card = buildCardMeta(
      {
        hasUserEntry: Boolean(enriched.userState),
        userState: enriched.userState?.state ?? null,
        continuePoint: extractContinuePoint(enriched.userState?.progress ?? null),
        hasNewEpisode: this.hasNewEpisode(show),
        isNewRelease: this.isNewRelease(show.releaseDate),
        isHit: isHitQuality(show.externalRatings),
        trendDelta: null,
        isTrending: false,
      },
      CARD_LIST_CONTEXT.DEFAULT,
    );

    // Compute verdict for details page using consensus rating (median of all sources)
    const { verdict, statusHint } = computeShowVerdict({
      status: show.status,
      externalRatings: show.externalRatings,
      badgeKey: card?.badgeKey ?? null,
      popularity: show.stats?.popularityScore ?? null,
      totalSeasons: show.totalSeasons,
      lastAirDate: show.lastAirDate,
    });

    return { ...enriched, card, verdict, statusHint };
  }

  /**
   * Gets the best available rating source (IMDb > Trakt > TMDB).
   */
  private getBestRating(
    ratings: {
      imdb?: { rating: number; voteCount?: number | null } | null;
      trakt?: { rating: number; voteCount?: number | null } | null;
      tmdb?: { rating: number; voteCount?: number | null } | null;
    } | null,
  ): {
    rating: { rating: number; voteCount?: number | null } | null;
    source: (typeof RATING_SOURCE)[keyof typeof RATING_SOURCE] | null;
  } {
    if (ratings?.imdb) return { rating: ratings.imdb, source: RATING_SOURCE.IMDB };
    if (ratings?.trakt) return { rating: ratings.trakt, source: RATING_SOURCE.TRAKT };
    if (ratings?.tmdb) return { rating: ratings.tmdb, source: RATING_SOURCE.TMDB };
    return { rating: null, source: null };
  }

  /**
   * Checks if show has a new episode (nextAirDate in the past week).
   */
  private hasNewEpisode(show: ShowDetails): boolean {
    if (!show.nextAirDate) return false;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const nextAir = new Date(show.nextAirDate);
    return nextAir >= weekAgo && nextAir <= now;
  }

  /**
   * Checks if show is a new release (within 14 days).
   */
  private isNewRelease(releaseDate: Date | null): boolean {
    if (!releaseDate) return false;
    const now = new Date();
    const diffMs = now.getTime() - new Date(releaseDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 14;
  }

  /**
   * Enriches a list of catalog items with user state.
   *
   * @param {{ id: string } | null | undefined} user - Optional authenticated user
   * @param {T[]} items - Items to enrich
   * @returns {Promise<Array<T & { type: MediaType; userState: any | null }>>} Enriched items
   */
  private async catalogUserListEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    items: T[],
  ): Promise<Array<T & { userState: UserMediaState | null }>> {
    const typed = items.map((i) => ({ ...i, userState: null as UserMediaState | null }));
    return this.userStateEnricher.enrichList(user?.id, typed);
  }

  /**
   * Enriches a single catalog item with user state.
   *
   * @param {{ id: string } | null | undefined} user - Optional authenticated user
   * @param {T} item - Item to enrich
   * @returns {Promise<T & { userState: any | null }>} Enriched item
   */
  private async catalogUserOneEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    item: T,
  ): Promise<T & { userState: UserMediaState | null }> {
    return this.userStateEnricher.enrichOne(user?.id, { ...item, userState: null });
  }

  /**
   * Groups calendar episodes by air date.
   *
   * @param {CalendarEpisode[]} episodes - Episodes to group
   * @returns {any[]} Days list
   */
  private groupEpisodesByDate(episodes: CalendarEpisode[]) {
    const map = new Map<string, any[]>();

    for (const ep of episodes) {
      const dateKey = ep.airDate.toISOString().split('T')[0];
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(ep);
    }

    const result = [];
    const sortedKeys = Array.from(map.keys()).sort();

    for (const date of sortedKeys) {
      result.push({
        date,
        episodes: map.get(date),
      });
    }

    return result;
  }
}
