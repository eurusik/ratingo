import {
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  IShowRepository,
  SHOW_REPOSITORY,
  CalendarEpisode,
} from '../../domain/repositories/show.repository.interface';
import { TrendingShowsQueryDto, TrendingShowsResponseDto } from '../dtos/trending.dto';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { CalendarResponseDto } from '../dtos/calendar-response.dto';
import { ShowResponseDto } from '../dtos/show-response.dto';
import { DefaultValuePipe, ParseIntPipe } from '@nestjs/common';

@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@Controller('catalog/shows')
export class CatalogShowsController {
  /**
   * Public show catalog endpoints (trending, calendar, details).
   */
  constructor(
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    private readonly userStateEnricher: CatalogUserStateEnricher,
  ) {}

  @Get('trending')
  /**
   * Returns trending shows list with pagination.
   */
  @ApiOperation({
    summary: 'Trending TV shows',
    description: 'Returns trending shows sorted by popularity and rating.',
  })
  @ApiOkResponse({ type: TrendingShowsResponseDto })
  async getTrendingShows(
    @Query() query: TrendingShowsQueryDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<TrendingShowsResponseDto> {
    const shows = await this.showRepository.findTrending(query);
    const data = await this.catalogUserListEnrich(user, shows, 'show');
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    return {
      data,
      meta: {
        count: shows.length,
        limit,
        offset,
      },
    };
  }

  @Get('calendar')
  /**
   * Returns show episodes grouped by date within a range.
   */
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
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days?: number,
  ): Promise<CalendarResponseDto> {
    const start = startDateString ? new Date(startDateString) : new Date();

    const end = new Date(start);
    end.setDate(end.getDate() + (days || 7));

    const episodes = await this.showRepository.findEpisodesByDateRange(start, end);

    const grouped = this.groupEpisodesByDate(episodes);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      days: grouped,
    };
  }

  @Get(':slug')
  /**
   * Returns show details by slug.
   */
  @ApiOperation({
    summary: 'Get show details by slug',
    description: 'Returns full show details including seasons list.',
  })
  @ApiOkResponse({ type: ShowResponseDto })
  async getShowBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<ShowResponseDto> {
    const show = await this.showRepository.findBySlug(slug);
    if (!show) {
      throw new NotFoundException(`Show with slug "${slug}" not found`);
    }
    const enriched = await this.catalogUserOneEnrich(user, show);
    return enriched as any;
  }

  private async catalogUserListEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    items: T[],
    type: 'show',
  ): Promise<Array<T & { type: 'show'; userState: any | null }>> {
    const typed = items.map((i) => ({ ...i, type, userState: null as any }));
    return this.userStateEnricher.enrichList(user?.id, typed);
  }

  private async catalogUserOneEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    item: T,
  ): Promise<T & { userState: any | null }> {
    return this.userStateEnricher.enrichOne(user?.id, { ...item, userState: null });
  }

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
