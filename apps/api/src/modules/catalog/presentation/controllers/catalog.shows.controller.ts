import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  CATALOG_DEFAULT_CALENDAR_DAYS,
  CATALOG_MAX_CALENDAR_DAYS,
  DEFAULT_PAGE_SIZE,
} from '../../../../common/constants';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { CardEnrichmentService } from '../../../shared/cards/application/card-enrichment.service';
import { CARD_LIST_CONTEXT } from '../../../shared/cards/domain/card.constants';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { ShowDetailsService } from '../../application/services/show-details.service';
import { ShowSyncService } from '../../application/services/show-sync.service';
import { ShowsCalendarService } from '../../application/services/shows-calendar.service';
import {
  type IShowRepository,
  SHOW_REPOSITORY,
} from '../../domain/repositories/show.repository.interface';
import { CalendarResponseDto } from '../dtos/calendar-response.dto';
import { NewEpisodesResponseDto } from '../dtos/new-episodes-response.dto';
import { ShowResponseDto } from '../dtos/show-response.dto';
import { SyncRequestResponseDto } from '../dtos/sync-request-response.dto';
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
  constructor(
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    private readonly userStateEnricher: CatalogUserStateEnricher,
    private readonly cards: CardEnrichmentService,
    private readonly showDetailsService: ShowDetailsService,
    private readonly showsCalendarService: ShowsCalendarService,
    private readonly showSyncService: ShowSyncService,
  ) {}

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
    const data = await this.userStateEnricher.enrichItemList(user?.id, shows);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.TRENDING_LIST,
    });

    return {
      data: withCards,
      meta: buildPaginationMeta(normalizedQuery, shows),
    };
  }

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
    const data = await this.userStateEnricher.enrichItemList(user?.id, shows);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.POPULAR_LIST,
    });

    return {
      data: withCards,
      meta: buildPaginationMeta(normalizedQuery, shows),
    };
  }

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
    const episodes = await this.showRepository.findNewEpisodes(days, limit);
    return { data: episodes };
  }

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
  @ApiQuery({
    name: 'personalized',
    required: false,
    enum: ['true', 'false'],
    description:
      'When true, returns only episodes from shows the authenticated user is currently watching.',
  })
  @ApiOkResponse({ type: CalendarResponseDto })
  @ApiBadRequestResponse({
    description: `Invalid query parameters (days must be <= ${CATALOG_MAX_CALENDAR_DAYS}; personalized must be 'true' or 'false')`,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required for personalized calendar',
  })
  async getCalendar(
    @Query('startDate') startDateString?: string,
    @Query('days', new DefaultValuePipe(CATALOG_DEFAULT_CALENDAR_DAYS), ParseIntPipe)
    days?: number,
    @Query('personalized') personalized?: string,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<CalendarResponseDto> {
    const start = startDateString ? new Date(startDateString) : new Date();
    if (startDateString && Number.isNaN(start.getTime())) {
      throw new BadRequestException('startDate must be a valid ISO date string');
    }
    // Normalize to start of day (UTC) so today's episodes are not filtered out as the day progresses
    start.setUTCHours(0, 0, 0, 0);

    const end = new Date(start);
    const daysToAdd =
      typeof days === 'number' && !Number.isNaN(days) ? days : CATALOG_DEFAULT_CALENDAR_DAYS;

    if (daysToAdd < 0) {
      throw new BadRequestException('days must be greater than or equal to 0');
    }
    if (daysToAdd > CATALOG_MAX_CALENDAR_DAYS) {
      throw new BadRequestException(
        `days must be less than or equal to ${CATALOG_MAX_CALENDAR_DAYS}`,
      );
    }
    end.setDate(end.getDate() + daysToAdd);

    if (personalized !== undefined && personalized !== 'true' && personalized !== 'false') {
      throw new BadRequestException("personalized must be 'true' or 'false'");
    }

    const isPersonalized = personalized === 'true';

    if (isPersonalized && !user) {
      throw new UnauthorizedException('Authentication required for personalized calendar');
    }

    const personalizedUserId = isPersonalized ? user!.id : undefined;

    const [episodes, watchingShowsCount] = await Promise.all([
      personalizedUserId
        ? this.showRepository.findEpisodesByDateRange(start, end, { userId: personalizedUserId })
        : this.showRepository.findEpisodesByDateRange(start, end),
      personalizedUserId
        ? this.showsCalendarService.getWatchingShowsCount(personalizedUserId)
        : Promise.resolve(undefined),
    ]);

    const grouped = groupEpisodesByDate(episodes);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      days: grouped,
      ...(isPersonalized ? { watchingShowsCount } : {}),
    };
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get show details by slug',
    description: 'Returns full show details including seasons list.',
  })
  @ApiOkResponse({ type: ShowResponseDto })
  async getShowBySlug(@Param('slug') slug: string, @CurrentUser() user?: { id: string } | null) {
    return this.showDetailsService.getBySlug(slug, user?.id);
  }

  @Post(':slug/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request metadata refresh for a show',
    description:
      'Queues a full metadata re-sync from TMDB/TVMaze. Rate-limited to once per 7 days per show globally; 5 requests per minute per user.',
  })
  @ApiAcceptedResponse({ type: SyncRequestResponseDto })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async requestShowSync(@Param('slug') slug: string): Promise<SyncRequestResponseDto> {
    return this.showSyncService.requestSync(slug);
  }
}
