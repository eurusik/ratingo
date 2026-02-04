import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CATALOG_DEFAULT_CALENDAR_DAYS, DEFAULT_PAGE_SIZE } from '../../../../common/constants';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { CardEnrichmentService } from '../../../shared/cards/application/card-enrichment.service';
import { CARD_LIST_CONTEXT } from '../../../shared/cards/domain/card.constants';
import type { UserMediaState } from '../../../user-media/domain/entities/user-media-state.entity';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { ShowDetailsService } from '../../application/services/show-details.service';
import {
  type IShowRepository,
  SHOW_REPOSITORY,
} from '../../domain/repositories/show.repository.interface';
import { NewEpisodesQuery } from '../../infrastructure/queries/new-episodes.query';
import { CalendarResponseDto } from '../dtos/calendar-response.dto';
import { NewEpisodesResponseDto } from '../dtos/new-episodes-response.dto';
import { ShowResponseDto } from '../dtos/show-response.dto';
import { TrendingShowsQueryDto, TrendingShowsResponseDto } from '../dtos/trending.dto';
import { CatalogDomainExceptionFilter } from '../filters';
import { groupEpisodesByDate } from '../utils/calendar.utils';
import { buildPaginationMeta } from '../utils/pagination.utils';
import { applyPaginationDefaults, normalizeListQuery } from '../utils/query-normalizer';

/**
 * Public show catalog endpoints (trending, calendar, details).
 */
@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@UseFilters(CatalogDomainExceptionFilter)
@Controller('catalog/shows')
export class CatalogShowsController {
  /**
   * Public show catalog endpoints (trending, calendar, details).
   */
  constructor(
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    private readonly userStateEnricher: CatalogUserStateEnricher,
    private readonly cards: CardEnrichmentService,
    private readonly newEpisodesQuery: NewEpisodesQuery,
    private readonly showDetailsService: ShowDetailsService,
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
    const normalizedQuery = applyPaginationDefaults(normalizeListQuery(query));
    const shows = await this.showRepository.findTrending(normalizedQuery);
    const data = await this.catalogUserListEnrich(user, shows);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.TRENDING_LIST,
    });

    return {
      data: withCards,
      meta: buildPaginationMeta(normalizedQuery, shows),
    };
  }

  /**
   * Returns popular shows list with pagination.
   * Shows historically popular shows without freshness gate.
   *
   * @param {TrendingShowsQueryDto} query - Query params
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<TrendingShowsResponseDto>} Popular shows response
   */
  @Get('popular')
  @ApiOperation({
    summary: 'Popular TV shows (Hits)',
    description: 'Returns historically popular shows. Includes classics.',
  })
  @ApiOkResponse({ type: TrendingShowsResponseDto })
  async getPopularShows(
    @Query() query: TrendingShowsQueryDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<TrendingShowsResponseDto> {
    const normalizedQuery = applyPaginationDefaults(normalizeListQuery(query));
    const shows = await this.showRepository.findPopular(normalizedQuery);
    const data = await this.catalogUserListEnrich(user, shows);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.POPULAR_LIST,
    });

    return {
      data: withCards,
      meta: buildPaginationMeta(normalizedQuery, shows),
    };
  }

  /**
   * Returns shows with new episodes (update feed).
   * Groups by show - one entry per show with the latest episode.
   *
   * @param {number} days - Number of days to look back (default: 7)
   * @param {number} limit - Max number of shows (default: 20)
   * @returns {Promise<NewEpisodesResponseDto>} New episodes response
   */
  @Get('new-episodes')
  @ApiOperation({
    summary: 'Shows with new episodes',
    description:
      'Returns shows that have aired new episodes recently. One entry per show with the latest episode.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to look back (default: 7).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of shows to return (default: 20).',
  })
  @ApiOkResponse({ type: NewEpisodesResponseDto })
  async getNewEpisodes(
    @Query('days', new DefaultValuePipe(CATALOG_DEFAULT_CALENDAR_DAYS), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(DEFAULT_PAGE_SIZE), ParseIntPipe) limit: number,
  ): Promise<NewEpisodesResponseDto> {
    const episodes = await this.newEpisodesQuery.execute(days, limit);
    return { data: episodes };
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
    @Query('days', new DefaultValuePipe(CATALOG_DEFAULT_CALENDAR_DAYS), ParseIntPipe)
    days?: number,
  ): Promise<CalendarResponseDto> {
    const start = startDateString ? new Date(startDateString) : new Date();
    if (startDateString && Number.isNaN(start.getTime())) {
      throw new BadRequestException('startDate must be a valid ISO date string');
    }

    const end = new Date(start);
    const daysToAdd =
      typeof days === 'number' && !Number.isNaN(days) ? days : CATALOG_DEFAULT_CALENDAR_DAYS;

    if (daysToAdd < 0) {
      throw new BadRequestException('days must be greater than or equal to 0');
    }
    end.setDate(end.getDate() + daysToAdd);

    const episodes = await this.showRepository.findEpisodesByDateRange(start, end);

    const grouped = groupEpisodesByDate(episodes);

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
    return this.showDetailsService.getBySlug(slug, user?.id);
  }

  /**
   * Enriches catalog items with user state.
   */
  private async catalogUserListEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    items: T[],
  ): Promise<Array<T & { userState: UserMediaState | null }>> {
    const typed = items.map((i) => ({ ...i, userState: null }));
    return this.userStateEnricher.enrichList(user?.id, typed);
  }
}
