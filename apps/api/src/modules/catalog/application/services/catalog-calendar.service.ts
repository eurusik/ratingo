import { Inject, Injectable } from '@nestjs/common';

import { addUtcDays, startOfUtcDay } from '@/common/utils/date.util';
import {
  CALENDAR_MOVIES_PER_DAY,
  CalendarMediaType,
  type CalendarMediaTypeValue,
} from '@/modules/catalog/domain/constants/catalog.constants';
import {
  WATCHING_SHOWS_COUNT_PORT,
  type IWatchingShowsCountPort,
} from '@/modules/catalog/domain/ports/watching-shows-count.port';
import {
  type CalendarMovieReleases,
  type IMovieRepository,
  MOVIE_REPOSITORY,
  type ReleaseDateRange,
} from '@/modules/catalog/domain/repositories/movie.repository.interface';
import {
  type CalendarEpisode,
  type CalendarEpisodesOptions,
  type IShowRepository,
  SHOW_REPOSITORY,
} from '@/modules/catalog/domain/repositories/show.repository.interface';
import {
  buildReleaseCalendar,
  type ReleaseCalendarDay,
} from '@/modules/catalog/domain/utils/release-calendar.utils';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

export interface CatalogCalendarRequest {
  startDate?: Date;
  days: number;
  viewerId?: string;
  personalized: boolean;
  premieresOnly?: boolean;
  type?: CalendarMediaTypeValue;
}

export interface CatalogCalendar extends ReleaseDateRange {
  days: ReleaseCalendarDay[];
  watchingShowsCount?: number;
}

function lastInstantBefore(date: Date): Date {
  return new Date(date.getTime() - 1);
}

const NO_MOVIES: CalendarMovieReleases = { movies: [], movieCountByDay: new Map() };

@Injectable()
export class CatalogCalendarService {
  constructor(
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @Inject(WATCHING_SHOWS_COUNT_PORT)
    private readonly watchingShowsCounter: IWatchingShowsCountPort,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async getCalendar(request: CatalogCalendarRequest): Promise<CatalogCalendar> {
    const from = startOfUtcDay(request.startDate ?? this.clock.now());
    const range = { from, toExclusive: addUtcDays(from, request.days) };
    const includesShows = request.type !== CalendarMediaType.MOVIE;
    const includesMovies = request.type !== CalendarMediaType.SHOW;

    const [episodes, movieReleases, watchingShowsCount] = await Promise.all([
      includesShows ? this.findEpisodes(range, request) : [],
      includesMovies ? this.findMovies(range, request) : NO_MOVIES,
      includesShows ? this.countWatchingShows(request) : undefined,
    ]);

    return {
      ...range,
      days: buildReleaseCalendar({ episodes, ...movieReleases }),
      ...(watchingShowsCount === undefined ? {} : { watchingShowsCount }),
    };
  }

  private countWatchingShows(request: CatalogCalendarRequest): Promise<number> | undefined {
    if (!request.personalized || !request.viewerId) return undefined;
    return this.watchingShowsCounter.countWatchingShows(request.viewerId);
  }

  private findEpisodes(
    range: ReleaseDateRange,
    request: CatalogCalendarRequest,
  ): Promise<CalendarEpisode[]> {
    const viewer: CalendarEpisodesOptions = request.viewerId
      ? { viewerId: request.viewerId, personalized: request.personalized }
      : {};
    const options = request.premieresOnly ? { ...viewer, premieresOnly: true } : viewer;
    return this.showRepository.findEpisodesByDateRange(
      range.from,
      lastInstantBefore(range.toExclusive),
      options,
    );
  }

  private findMovies(
    range: ReleaseDateRange,
    request: CatalogCalendarRequest,
  ): Promise<CalendarMovieReleases> {
    return this.movieRepository.findReleasesByDateRange(range, {
      viewerId: request.viewerId,
      personalized: request.personalized,
      perDayLimit: request.personalized ? undefined : CALENDAR_MOVIES_PER_DAY,
    });
  }
}
