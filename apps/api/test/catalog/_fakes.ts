import { MediaType } from '../../src/common/enums/media-type.enum';
import {
  MovieWithMedia,
  NowPlayingOptions,
  IMovieRepository,
} from '../../src/modules/catalog/domain/repositories/movie.repository.interface';
import {
  IShowRepository,
  TrendingShowItem,
  TrendingShowsOptions,
  CalendarEpisode,
} from '../../src/modules/catalog/domain/repositories/show.repository.interface';
import { moviesFixture, showsFixture, daysAgo } from './_fixtures';

const matchesGenres = (list: { genres?: any[] }, genres?: string[]) => {
  if (!genres?.length) return true;
  return (list.genres ?? []).some((g) => genres.includes(g.slug));
};

const matchesVotes = (item: any, voteSource?: string, minVotes?: number) => {
  if (minVotes === undefined || !voteSource) return true;
  const src = item.externalRatings?.[voteSource];
  return (src?.voteCount ?? 0) >= minVotes;
};

const matchesYear = (
  date: Date | null | undefined,
  year?: number,
  yearFrom?: number,
  yearTo?: number,
) => {
  if (!date) return false;
  const y = date.getUTCFullYear();
  if (year !== undefined) return y === year;
  if (yearFrom !== undefined && y < yearFrom) return false;
  if (yearTo !== undefined && y > yearTo) return false;
  return true;
};

const applyMovieFilters = (items: MovieWithMedia[], options: any) => {
  let res = [...items];
  const { genres, minRatingo, voteSource, minVotes, year, yearFrom, yearTo } = options ?? {};
  if (genres?.length) res = res.filter((m) => matchesGenres(m, genres));
  if (typeof minRatingo === 'number')
    res = res.filter((m) => (m.stats?.ratingoScore ?? 0) >= minRatingo);
  if (minVotes !== undefined || voteSource)
    res = res.filter((m) => matchesVotes(m, voteSource, minVotes));
  if (year !== undefined || yearFrom !== undefined || yearTo !== undefined) {
    res = res.filter((m) => matchesYear(m.releaseDate, year, yearFrom, yearTo));
  }
  return res;
};

const applyShowFilters = (items: any[], options: TrendingShowsOptions) => {
  let res = [...items];
  const { genres, minRatingo, voteSource, minVotes, year, yearFrom, yearTo } = options ?? {};
  if (genres?.length) res = res.filter((m) => matchesGenres(m, genres));
  if (typeof minRatingo === 'number')
    res = res.filter((m) => (m.stats?.ratingoScore ?? 0) >= minRatingo);
  if (minVotes !== undefined || voteSource)
    res = res.filter((m) => matchesVotes(m, voteSource, minVotes));
  if (year !== undefined || yearFrom !== undefined || yearTo !== undefined) {
    res = res.filter((m: any) => matchesYear(m.releaseDate, year, yearFrom, yearTo));
  }
  return res;
};

const applySort = <T>(
  items: T[],
  sort: string | undefined,
  order: string | undefined,
  selectors: {
    popularity: (x: T) => number;
    ratingo: (x: T) => number;
    releaseDate?: (x: T) => number;
  },
) => {
  const dir = order === 'asc' ? 1 : -1;
  const pick = () => {
    if (sort === 'ratingo') return selectors.ratingo;
    if (sort === 'releaseDate' && selectors.releaseDate) return selectors.releaseDate;
    if (sort === 'tmdbPopularity') return selectors.popularity;
    return selectors.popularity; // default popularity
  };
  const getValue = pick();
  return [...items].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    if (av !== bv) return av > bv ? dir : -dir;
    return (a as any).id > (b as any).id ? dir : -dir;
  });
};

const paginate = <T>(items: T[], limit = 20, offset = 0) => {
  const page = items.slice(offset, offset + limit);
  (page as any).total = items.length;
  return page;
};

export class FakeMovieRepository implements IMovieRepository {
  public throwOnTrending = false;
  public lastNowPlayingOptions: NowPlayingOptions | undefined;
  public lastNewReleasesOptions: NowPlayingOptions | undefined;
  public lastNewOnDigitalOptions: NowPlayingOptions | undefined;
  public lastTrendingOptions: any;

  private items = moviesFixture;

  async findNowPlaying(options?: NowPlayingOptions): Promise<MovieWithMedia[]> {
    this.lastNowPlayingOptions = options;
    const filtered = applyMovieFilters(this.items, options);
    const sorted = applySort(filtered, options?.sort, options?.order, {
      popularity: (m) => m.stats?.popularityScore ?? m.popularity ?? 0,
      ratingo: (m) => m.stats?.ratingoScore ?? 0,
      releaseDate: (m) => (m.releaseDate ? m.releaseDate.getTime() : -Infinity),
    });
    return paginate(sorted, options?.limit, options?.offset);
  }

  async findNewReleases(options?: NowPlayingOptions): Promise<MovieWithMedia[]> {
    this.lastNewReleasesOptions = options;
    const daysBack = options?.daysBack;
    const windowed =
      typeof daysBack === 'number'
        ? this.items.filter(
            (m) =>
              m.theatricalReleaseDate &&
              m.theatricalReleaseDate >= daysAgo(daysBack) &&
              m.theatricalReleaseDate <= new Date(),
          )
        : this.items;
    const filtered = applyMovieFilters(windowed, options);
    const sorted = applySort(filtered, options?.sort, options?.order, {
      popularity: (m) => m.stats?.popularityScore ?? m.popularity ?? 0,
      ratingo: (m) => m.stats?.ratingoScore ?? 0,
      releaseDate: (m) => (m.theatricalReleaseDate ? m.theatricalReleaseDate.getTime() : -Infinity),
    });
    return paginate(sorted, options?.limit, options?.offset);
  }

  async findNewOnDigital(options?: NowPlayingOptions): Promise<MovieWithMedia[]> {
    this.lastNewOnDigitalOptions = options;
    const daysBack = options?.daysBack;
    const windowed =
      typeof daysBack === 'number'
        ? this.items.filter(
            (m) =>
              m.digitalReleaseDate &&
              m.digitalReleaseDate >= daysAgo(daysBack) &&
              m.digitalReleaseDate <= new Date(),
          )
        : this.items;
    const filtered = applyMovieFilters(windowed, options);
    const sorted = applySort(filtered, options?.sort, options?.order, {
      popularity: (m) => m.stats?.popularityScore ?? m.popularity ?? 0,
      ratingo: (m) => m.stats?.ratingoScore ?? 0,
      releaseDate: (m) => (m.digitalReleaseDate ? m.digitalReleaseDate.getTime() : -Infinity),
    });
    return paginate(sorted, options?.limit, options?.offset);
  }

  async findTrending(options?: any): Promise<any[]> {
    if (this.throwOnTrending) {
      throw new Error('boom');
    }
    this.lastTrendingOptions = options;
    const filtered = applyMovieFilters(this.items, options);
    const sorted = applySort(filtered, options?.sort, options?.order, {
      popularity: (m) => m.stats?.popularityScore ?? m.popularity ?? 0,
      ratingo: (m) => m.stats?.ratingoScore ?? 0,
      releaseDate: (m) => (m.releaseDate ? m.releaseDate.getTime() : -Infinity),
    });
    return paginate(sorted, options?.limit, options?.offset);
  }

  async setNowPlaying(): Promise<void> {
    return;
  }

  async updateReleaseDates(): Promise<void> {
    return;
  }

  async upsertDetails(): Promise<void> {
    return;
  }

  async findBySlug(slug: string): Promise<any | null> {
    return this.items.find((m) => m.slug === slug) ?? null;
  }
}

export class FakeShowRepository implements IShowRepository {
  public lastTrendingOptions: TrendingShowsOptions | undefined;
  private items = showsFixture;

  async upsertDetails(): Promise<void> {
    return;
  }

  async findShowsForAnalysis(): Promise<any[]> {
    return [];
  }

  async saveDropOffAnalysis(): Promise<void> {
    return;
  }

  async getDropOffAnalysis(): Promise<any | null> {
    return null;
  }

  async findEpisodesByDateRange(start: Date, end: Date): Promise<CalendarEpisode[]> {
    return [
      {
        showId: 'sid-1',
        showTitle: 'Show One',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        title: 'Pilot',
        overview: null,
        airDate: start,
        runtime: 45,
        stillPath: null,
      },
    ];
  }

  async findTrending(options: TrendingShowsOptions): Promise<any[]> {
    this.lastTrendingOptions = options;
    const filtered = applyShowFilters(this.items as any, options);
    const sorted = applySort(filtered, options?.sort, options?.order, {
      popularity: (s: any) => (s.stats?.popularityScore ?? s.popularity ?? 0) as number,
      ratingo: (s: any) => (s.stats?.ratingoScore ?? 0) as number,
      releaseDate: (s: any) => (s.releaseDate ? s.releaseDate.getTime() : -Infinity),
    });
    const limit = options?.limit ?? filtered.length;
    const offset = options?.offset ?? 0;
    const page = sorted.slice(offset, offset + limit);
    (page as any).total = sorted.length;
    return page;
  }

  async findBySlug(slug: string): Promise<any | null> {
    return this.items.find((s) => s.slug === slug) ?? null;
  }
}
