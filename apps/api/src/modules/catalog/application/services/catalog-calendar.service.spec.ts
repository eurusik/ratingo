import * as fc from 'fast-check';

import type {
  CalendarMovie,
  CalendarMovieReleases,
} from '@/modules/catalog/domain/repositories/movie.repository.interface';
import type { CalendarEpisode } from '@/modules/catalog/domain/repositories/show.repository.interface';

import { CatalogCalendarService } from './catalog-calendar.service';

const NOW = new Date('2026-11-17T15:30:00.000Z');
const TODAY = new Date('2026-11-17T00:00:00.000Z');

const episode = (airDate: string, episodeId = 'e1'): CalendarEpisode => ({
  episodeId,
  showId: 's1',
  showRecordId: 'r1',
  showSlug: 'show',
  showTitle: 'Show',
  posterPath: null,
  seasonNumber: 1,
  episodeNumber: 1,
  title: null,
  overview: null,
  airDate: new Date(airDate),
  runtime: null,
  stillPath: null,
  seasonEpisodeCount: null,
  showPopularity: 10,
  isTracked: false,
  isSaved: false,
  isWatched: false,
});

const movie = (releaseDate: string, mediaItemId = 'm1'): CalendarMovie => ({
  mediaItemId,
  tmdbId: 1,
  slug: mediaItemId,
  title: mediaItemId,
  poster: null,
  releaseDate: new Date(releaseDate),
  releaseDateKind: 'theatrical',
  releaseCountry: 'US',
  popularity: 50,
  isSavedForLater: false,
  isReminderSet: false,
});

describe('CatalogCalendarService', () => {
  let showRepository: { findEpisodesByDateRange: jest.Mock };
  let movieRepository: { findReleasesByDateRange: jest.Mock };
  let watchingShowsCounter: { countWatchingShows: jest.Mock };
  let service: CatalogCalendarService;

  const movieReleases = (
    movies: CalendarMovie[],
    counts: [string, number][] = [],
  ): CalendarMovieReleases => ({ movies, movieCountByDay: new Map(counts) });

  beforeEach(() => {
    showRepository = { findEpisodesByDateRange: jest.fn().mockResolvedValue([]) };
    movieRepository = { findReleasesByDateRange: jest.fn().mockResolvedValue(movieReleases([])) };
    watchingShowsCounter = { countWatchingShows: jest.fn().mockResolvedValue(3) };
    service = new CatalogCalendarService(
      showRepository as never,
      movieRepository as never,
      watchingShowsCounter as never,
      { now: () => NOW },
    );
  });

  it('starts today when no start date is given and spans the requested days', async () => {
    const calendar = await service.getCalendar({ days: 7, personalized: false });

    const range = { from: TODAY, toExclusive: new Date('2026-11-24T00:00:00.000Z') };
    expect(calendar).toMatchObject(range);
    expect(showRepository.findEpisodesByDateRange).toHaveBeenCalledWith(
      range.from,
      new Date('2026-11-23T23:59:59.999Z'),
      {},
    );
    expect(movieRepository.findReleasesByDateRange).toHaveBeenCalledWith(range, {
      viewerId: undefined,
      personalized: false,
      perDayLimit: 5,
    });
    expect(watchingShowsCounter.countWatchingShows).not.toHaveBeenCalled();
    expect(calendar).not.toHaveProperty('watchingShowsCount');
  });

  it('normalizes the start date to the start of its UTC day', async () => {
    const calendar = await service.getCalendar({
      startDate: new Date('2026-12-01T18:00:00.000Z'),
      days: 1,
      personalized: false,
    });

    expect(calendar.from).toEqual(new Date('2026-12-01T00:00:00.000Z'));
    expect(calendar.toExclusive).toEqual(new Date('2026-12-02T00:00:00.000Z'));
  });

  it('merges episodes and movies into sorted days and skips empty days', async () => {
    showRepository.findEpisodesByDateRange.mockResolvedValue([
      episode('2026-11-19T00:00:00.000Z'),
      episode('2026-11-17T20:00:00.000Z', 'e2'),
    ]);
    movieRepository.findReleasesByDateRange.mockResolvedValue(
      movieReleases(
        [movie('2026-11-19T00:00:00.000Z'), movie('2026-11-21T00:00:00.000Z', 'm2')],
        [
          ['2026-11-19', 8],
          ['2026-11-21', 1],
        ],
      ),
    );

    const { days } = await service.getCalendar({ days: 7, personalized: false });

    expect(days.map((day) => day.date)).toEqual(['2026-11-17', '2026-11-19', '2026-11-21']);
    expect(days[0]).toEqual({ date: '2026-11-17', episodes: [expect.anything()], movies: [] });
    expect(days[1]).toMatchObject({ moreMoviesCount: 7 });
    expect(days[1].episodes).toHaveLength(1);
    expect(days[2]).not.toHaveProperty('moreMoviesCount');
  });

  it("returns the viewer's releases without a per-day movie limit", async () => {
    const calendar = await service.getCalendar({
      days: 7,
      personalized: true,
      viewerId: 'user-1',
    });

    expect(showRepository.findEpisodesByDateRange).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
      { viewerId: 'user-1', personalized: true },
    );
    expect(movieRepository.findReleasesByDateRange).toHaveBeenCalledWith(expect.anything(), {
      viewerId: 'user-1',
      personalized: true,
      perDayLimit: undefined,
    });
    expect(calendar.watchingShowsCount).toBe(3);
  });

  it('passes the premieres filter to the episode lookup', async () => {
    await service.getCalendar({ days: 90, personalized: false, premieresOnly: true, type: 'show' });

    expect(showRepository.findEpisodesByDateRange).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
      { premieresOnly: true },
    );
  });

  it('keeps the viewer when filtering premieres', async () => {
    await service.getCalendar({
      days: 90,
      personalized: false,
      premieresOnly: true,
      viewerId: 'user-1',
      type: 'show',
    });

    expect(showRepository.findEpisodesByDateRange).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
      { viewerId: 'user-1', personalized: false, premieresOnly: true },
    );
  });

  it('skips movies for the show calendar', async () => {
    await service.getCalendar({ days: 7, personalized: false, type: 'show' });

    expect(movieRepository.findReleasesByDateRange).not.toHaveBeenCalled();
  });

  it('skips episodes and the watching count for the movie calendar', async () => {
    const calendar = await service.getCalendar({
      days: 7,
      personalized: true,
      viewerId: 'user-1',
      type: 'movie',
    });

    expect(showRepository.findEpisodesByDateRange).not.toHaveBeenCalled();
    expect(watchingShowsCounter.countWatchingShows).not.toHaveBeenCalled();
    expect(calendar).not.toHaveProperty('watchingShowsCount');
  });

  it('puts every release into exactly one sorted day and counts the hidden movies', async () => {
    const dayOffset = fc.integer({ min: 0, max: 6 });
    const hour = fc.integer({ min: 0, max: 23 });
    const at = (offset: number, h: number): string =>
      new Date(TODAY.getTime() + offset * 86_400_000 + h * 3_600_000).toISOString();

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(dayOffset, hour), { maxLength: 8 }),
        fc.array(dayOffset, { maxLength: 8 }),
        fc.integer({ min: 0, max: 3 }),
        async (episodeTimes, movieDays, hiddenPerDay) => {
          const episodes = episodeTimes.map(([d, h], i) => episode(at(d, h), `e${i}`));
          const movies = movieDays.map((d, i) => movie(at(d, 0), `m${i}`));
          const shownPerDay = new Map<string, number>();
          for (const m of movies) {
            const key = m.releaseDate.toISOString().slice(0, 10);
            shownPerDay.set(key, (shownPerDay.get(key) ?? 0) + 1);
          }
          const counts = [...shownPerDay].map(([key, shown]): [string, number] => [
            key,
            shown + hiddenPerDay,
          ]);
          showRepository.findEpisodesByDateRange.mockResolvedValue(episodes);
          movieRepository.findReleasesByDateRange.mockResolvedValue(movieReleases(movies, counts));

          const { days } = await service.getCalendar({ days: 7, personalized: false });

          const dates = days.map((d) => d.date);
          expect(dates).toEqual([...new Set(dates)].sort());
          expect(days.flatMap((d) => d.episodes)).toHaveLength(episodes.length);
          expect(days.flatMap((d) => d.movies)).toHaveLength(movies.length);
          for (const d of days) {
            expect(d.episodes.length + d.movies.length).toBeGreaterThan(0);
            for (const e of d.episodes) expect(e.airDate.toISOString().slice(0, 10)).toBe(d.date);
            for (const m of d.movies) expect(m.releaseDate.toISOString().slice(0, 10)).toBe(d.date);
            const expectedHidden = d.movies.length > 0 ? hiddenPerDay : 0;
            expect(d.moreMoviesCount ?? 0).toBe(expectedHidden);
          }
        },
      ),
    );
  });
});
