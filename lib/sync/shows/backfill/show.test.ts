import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchShowsNeedingMeta,
  selectPreferredShowVideos,
  getPreferredShowCast,
  getCombinedShowProviders,
  computeLatestSeason,
  extractEpisodeAirInfo,
  resolveTraktIdentifier,
  buildShowMetaBundle,
  applyShowMetaUpdate,
  updateShowCounters,
  runMetaBackfill,
  backfillShowMetaById,
} from './show';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn(),
    transaction: vi.fn(async (fn: any) => {
      const tx: any = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn(),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      };
      await fn(tx);
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  shows: {
    id: { name: 'id' },
    tmdbId: { name: 'tmdb_id' },
    backdrop: { name: 'backdrop' },
    genres: { name: 'genres' },
    videos: { name: 'videos' },
    cast: { name: 'cast' },
    numberOfSeasons: { name: 'number_of_seasons' },
    numberOfEpisodes: { name: 'number_of_episodes' },
    latestSeasonNumber: { name: 'latest_season_number' },
    latestSeasonEpisodes: { name: 'latest_season_episodes' },
    lastEpisodeSeason: { name: 'last_episode_season' },
    lastEpisodeNumber: { name: 'last_episode_number' },
    lastEpisodeAirDate: { name: 'last_episode_air_date' },
    nextEpisodeSeason: { name: 'next_episode_season' },
    nextEpisodeNumber: { name: 'next_episode_number' },
    nextEpisodeAirDate: { name: 'next_episode_air_date' },
    status: { name: 'status' },
    tagline: { name: 'tagline' },
    firstAirDate: { name: 'first_air_date' },
    watchProviders: { name: 'watch_providers' },
    contentRating: { name: 'content_rating' },
    updatedAt: { name: 'updated_at' },
  },
  showRelated: {
    showId: { name: 'show_id' },
    relatedShowId: { name: 'related_show_id' },
    source: { name: 'source' },
    rank: { name: 'rank' },
  },
  showAirings: {
    traktId: { name: 'trakt_id' },
    tmdbId: { name: 'tmdb_id' },
  },
}));

vi.mock('@/lib/api/tmdb', () => ({
  tmdbClient: {
    getShowVideos: vi.fn(),
    getAggregateCredits: vi.fn(),
    getWatchProvidersByRegion: vi.fn(),
    getContentRatingByRegion: vi.fn(),
    getShowDetails: vi.fn(),
    getShowGenres: vi.fn(),
  },
}));

vi.mock('@/lib/api/trakt', () => ({
  traktClient: {
    findShowByTmdbId: vi.fn(),
  },
}));

vi.mock('@/lib/sync/utils', () => ({
  withRetry: vi.fn(async (fn: any) => await fn()),
}));

vi.mock('@/lib/sync/related', () => ({
  getRelatedTmdbIds: vi.fn(async () => ({ ids: [101, 102], source: 'tmdb' })),
}));

vi.mock('@/lib/sync/shows/processing', () => ({
  ensureRelatedShows: vi.fn(async () => 2),
  linkRelated: vi.fn(async () => 2),
  createProcessShowCaches: vi.fn(() => ({
    tmdbDetailsCache: { get: vi.fn(), set: vi.fn() },
    tmdbTranslationCache: { get: vi.fn(), set: vi.fn() },
    tmdbProvidersCache: { get: vi.fn(), set: vi.fn() },
    tmdbContentRatingCache: { get: vi.fn(), set: vi.fn() },
    tmdbExternalIdsCache: { get: vi.fn(), set: vi.fn() },
  })),
}));

vi.mock('@/lib/sync/shows/upserts', () => ({
  upsertShowCast: vi.fn(async () => {}),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const original = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...original,
    eq: vi.fn((field: any, value: any) => ({ field: field.name, value, op: 'eq' })),
    or: vi.fn((...args: any[]) => args),
    isNull: vi.fn((field: any) => ({ field: field.name, op: 'isNull' })),
    inArray: vi.fn((field: any, arr: any[]) => ({ field: field.name, arr })),
    and: vi.fn((...args: any[]) => args),
    sql: vi.fn((strings: TemplateStringsArray, ...vals: any[]) => ({
      text: strings.join('${}'),
      vals,
    })),
  };
});

import { db } from '@/db';
import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';

describe('shows/backfill/show', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchShowsNeedingMeta повертає рядки з БД', async () => {
    const rows: any[] = [{ id: 1, tmdbId: 10 }];
    vi.mocked(db.limit).mockResolvedValue(rows);
    const res = await fetchShowsNeedingMeta(5);
    expect(res).toEqual(rows);
    expect(db.select).toHaveBeenCalled();
    expect(db.limit).toHaveBeenCalledWith(5);
  });

  it('selectPreferredShowVideos обирає пріоритетні YouTube відео або фолбек', async () => {
    vi.mocked(tmdbClient.getShowVideos).mockResolvedValue({
      results: [
        { site: 'YouTube', type: 'Trailer' },
        { site: 'YouTube', type: 'Clip' },
        { site: 'Vimeo', type: 'Trailer' },
      ],
    } as any);
    const res1 = await selectPreferredShowVideos(123);
    expect(res1).toHaveLength(2);
    vi.mocked(tmdbClient.getShowVideos).mockResolvedValue({
      results: [
        { site: 'YouTube', type: 'Other' },
        { site: 'Vimeo', type: 'Teaser' },
      ],
    } as any);
    const res2 = await selectPreferredShowVideos(123);
    expect(res2).toHaveLength(1);
  });

  it('getPreferredShowCast повертає топ 12 та мапінг полів', async () => {
    const roles = [{ character: 'A' }];
    const cast = Array.from({ length: 15 }).map((_, i) => ({
      id: i + 1,
      name: `N${i + 1}`,
      roles,
      profile_path: `/p${i + 1}`,
      order: i,
    }));
    vi.mocked(tmdbClient.getAggregateCredits).mockResolvedValue({ cast } as any);
    const res = await getPreferredShowCast(10);
    expect(res).toHaveLength(12);
    expect(res[0]).toMatchObject({
      id: 1,
      name: 'N1',
      character: 'A',
      profile_path: '/p1',
      order: 0,
    });
    vi.mocked(tmdbClient.getAggregateCredits).mockRejectedValue(new Error('x'));
    const res2 = await getPreferredShowCast(10);
    expect(res2).toEqual([]);
  });

  it('getCombinedShowProviders обʼєднує провайдери без дублювань', async () => {
    vi.mocked(tmdbClient.getWatchProvidersByRegion).mockImplementation(
      async (id: number, region: string) =>
        (region === 'UA'
          ? [
              { region: 'UA', id: 1, name: 'A' },
              { region: 'UA', id: 2, name: 'B' },
            ]
          : [
              { region: 'US', id: 2, name: 'B' },
              { region: 'US', id: 3, name: 'C' },
            ]) as any
    );
    const res = await getCombinedShowProviders(10);
    expect(res).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ region: 'UA', id: 1 }),
        expect.objectContaining({ region: 'UA', id: 2 }),
        expect.objectContaining({ region: 'US', id: 3 }),
      ])
    );
    expect(res.find((p) => p.region === 'US' && p.id === 2)).toBeDefined();
  });

  it('computeLatestSeason коректно визначає останній сезон', () => {
    const detailsA: any = {
      seasons: [
        { season_number: 0, episode_count: 1 },
        { season_number: 1, episode_count: 10 },
        { season_number: 2, episode_count: 8 },
      ],
    };
    const a = computeLatestSeason(detailsA);
    expect(a.latestSeasonNumber).toBe(2);
    expect(a.latestSeasonEpisodes).toBe(8);
    const detailsB: any = { seasons: [{ season_number: 0, episode_count: 12 }] };
    const b = computeLatestSeason(detailsB);
    expect(b.latestSeasonNumber).toBe(0);
    expect(b.latestSeasonEpisodes).toBe(12);
  });

  it('extractEpisodeAirInfo повертає поля епізодів', () => {
    const details: any = {
      last_episode_to_air: { season_number: 3, episode_number: 5, air_date: '2024-01-01' },
      next_episode_to_air: { season_number: 4, episode_number: 1, air_date: '2024-06-01' },
    };
    const info = extractEpisodeAirInfo(details);
    expect(info).toEqual({
      lastEpisodeSeason: 3,
      lastEpisodeNumber: 5,
      lastEpisodeAirDate: '2024-01-01',
      nextEpisodeSeason: 4,
      nextEpisodeNumber: 1,
      nextEpisodeAirDate: '2024-06-01',
    });
  });

  it('resolveTraktIdentifier використовує show_airings або фолбек на Trakt', async () => {
    const tx: any = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ traktId: 'slug-1' }]),
    };
    let res = await resolveTraktIdentifier(tx, 100);
    expect(res).toBe('slug-1');
    vi.mocked(tx.limit).mockResolvedValueOnce([]);
    vi.mocked(traktClient.findShowByTmdbId).mockResolvedValueOnce({
      show: { ids: { slug: 's', trakt: 77 } },
    } as any);
    res = await resolveTraktIdentifier(tx, 100);
    expect(res).toBe('s');
    vi.mocked(tx.limit).mockResolvedValueOnce([]);
    vi.mocked(traktClient.findShowByTmdbId).mockResolvedValueOnce({
      show: { ids: { trakt: 77 } },
    } as any);
    res = await resolveTraktIdentifier(tx, 100);
    expect(res).toBe(77);
  });

  it('buildShowMetaBundle збирає всі частини', async () => {
    vi.mocked(tmdbClient.getShowDetails).mockResolvedValue({
      backdrop_path: '/b.jpg',
      genres: [{ id: 1, name: 'Action' }],
      first_air_date: '2020-01-01',
      number_of_seasons: 3,
      number_of_episodes: 24,
      status: 'Ended',
      tagline: 'T',
      seasons: [
        { season_number: 1, episode_count: 10 },
        { season_number: 3, episode_count: 12 },
      ],
    } as any);
    vi.mocked(tmdbClient.getShowVideos).mockResolvedValue({
      results: [{ site: 'YouTube', type: 'Trailer' }],
    } as any);
    vi.mocked(tmdbClient.getAggregateCredits).mockResolvedValue({
      cast: [{ id: 1, name: 'A', roles: [{ character: 'C' }] }],
    } as any);
    vi.mocked(tmdbClient.getWatchProvidersByRegion).mockImplementation(
      async (id: number, region: string) =>
        (region === 'UA' ? [{ region: 'UA', id: 1 }] : [{ region: 'US', id: 2 }]) as any
    );
    vi.mocked(tmdbClient.getContentRatingByRegion).mockResolvedValue('16+');
    const b = await buildShowMetaBundle(123);
    expect(b.tmdbShowDetails.first_air_date).toBe('2020-01-01');
    expect(b.videosPreferred).toHaveLength(1);
    expect(b.castPreferred).toHaveLength(1);
    expect(b.providersCombined).toHaveLength(2);
    expect(b.contentRatingUa).toBe('16+');
    expect(b.latestSeasonNumber).toBe(3);
    expect(b.latestSeasonEpisodes).toBe(12);
  });

  it('applyShowMetaUpdate оновлює БД та лінкує related', async () => {
    const tx: any = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(tx.where).mockResolvedValueOnce([{ relatedShowId: 20 }]);
    vi.mocked(tx.where).mockResolvedValueOnce([{ id: 20, tmdbId: 999 }]);
    const showRow: any = {
      id: 10,
      tmdbId: 123,
      backdrop: null,
      genres: [],
      videos: [],
      cast: [],
      numberOfSeasons: null,
      numberOfEpisodes: null,
      latestSeasonNumber: null,
      latestSeasonEpisodes: null,
      lastEpisodeSeason: null,
      lastEpisodeNumber: null,
      lastEpisodeAirDate: null,
      nextEpisodeSeason: null,
      nextEpisodeNumber: null,
      nextEpisodeAirDate: null,
      status: null,
      tagline: null,
      firstAirDate: null,
      watchProviders: [],
      contentRating: null,
    };
    const b: any = {
      tmdbShowDetails: {
        backdrop_path: '/b.jpg',
        genres: [{ id: 1, name: 'Action' }],
        first_air_date: '2020-01-01',
        number_of_seasons: 3,
        number_of_episodes: 24,
        status: 'Ended',
        tagline: 'T',
      },
      videosPreferred: [{ a: 1 }],
      castPreferred: [{ id: 1 }],
      providersCombined: [{ id: 1 }],
      contentRatingUa: '16+',
      latestSeasonNumber: 3,
      latestSeasonEpisodes: 12,
      lastEpisodeSeason: 2,
      lastEpisodeNumber: 10,
      lastEpisodeAirDate: '2024-01-01',
      nextEpisodeSeason: 4,
      nextEpisodeNumber: 1,
      nextEpisodeAirDate: '2024-06-01',
    };
    const { upsertShowCast } = await import('@/lib/sync/shows/upserts');
    const { ensureRelatedShows, linkRelated } = await import('@/lib/sync/shows/processing');
    await applyShowMetaUpdate(tx, showRow, b);
    expect(tx.update).toHaveBeenCalled();
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ backdrop: '/b.jpg', contentRating: '16+' })
    );
    expect(upsertShowCast).toHaveBeenCalledTimes(1);
    expect(ensureRelatedShows).toHaveBeenCalledTimes(1);
    expect(linkRelated).toHaveBeenCalledTimes(1);
  });

  it('updateShowCounters інкрементує лічильники', () => {
    const stats: any = {
      processed: 0,
      updatedRows: 0,
      videosFilled: 0,
      videosStillMissing: 0,
      providersFilled: 0,
      providersStillMissing: 0,
      backdropFilled: 0,
      genresFilled: 0,
      firstAirDateFilled: 0,
      numberOfSeasonsFilled: 0,
      numberOfEpisodesFilled: 0,
      statusFilled: 0,
      taglineFilled: 0,
      contentRatingFilled: 0,
      errors: 0,
    };
    const showRow: any = {
      backdrop: null,
      genres: [],
      videos: [],
      watchProviders: [],
      firstAirDate: null,
      numberOfSeasons: null,
      numberOfEpisodes: null,
      status: null,
      tagline: null,
      contentRating: null,
    };
    const b: any = {
      tmdbShowDetails: {
        backdrop_path: '/b',
        genres: [{ id: 1, name: 'x' }],
        first_air_date: 'd',
        number_of_seasons: 1,
        number_of_episodes: 2,
        status: 'st',
        tagline: 't',
      },
      videosPreferred: [{ v: 1 }],
      providersCombined: [{ p: 1 }],
      contentRatingUa: '16+',
    };
    updateShowCounters(stats, showRow, b);
    expect(stats.backdropFilled).toBe(1);
    expect(stats.genresFilled).toBe(1);
    expect(stats.firstAirDateFilled).toBe(1);
    expect(stats.numberOfSeasonsFilled).toBe(1);
    expect(stats.numberOfEpisodesFilled).toBe(1);
    expect(stats.statusFilled).toBe(1);
    expect(stats.taglineFilled).toBe(1);
    expect(stats.contentRatingFilled).toBe(1);
    expect(stats.videosFilled).toBe(1);
    expect(stats.providersFilled).toBe(1);
  });

  it('runMetaBackfill обробляє рядки та повертає статистику', async () => {
    const rows: any[] = [
      {
        id: 1,
        tmdbId: 10,
        backdrop: null,
        genres: [],
        videos: [],
        cast: [],
        numberOfSeasons: null,
        numberOfEpisodes: null,
        latestSeasonNumber: null,
        latestSeasonEpisodes: null,
        lastEpisodeSeason: null,
        lastEpisodeNumber: null,
        lastEpisodeAirDate: null,
        nextEpisodeSeason: null,
        nextEpisodeNumber: null,
        nextEpisodeAirDate: null,
        status: null,
        tagline: null,
        firstAirDate: null,
        watchProviders: [],
        contentRating: null,
      },
    ];
    vi.mocked(db.limit).mockResolvedValue(rows);
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx: any = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ traktId: null }]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      };
      await fn(tx);
    });
    vi.mocked(tmdbClient.getShowDetails).mockResolvedValue({ seasons: [] } as any);
    vi.mocked(tmdbClient.getShowVideos).mockResolvedValue({ results: [] } as any);
    vi.mocked(tmdbClient.getAggregateCredits).mockResolvedValue({ cast: [] } as any);
    vi.mocked(tmdbClient.getWatchProvidersByRegion).mockResolvedValue([] as any);
    vi.mocked(tmdbClient.getContentRatingByRegion).mockResolvedValue(null);
    const res = await runMetaBackfill();
    expect(res.updated).toBe(1);
    expect(res.stats.processed).toBe(1);
    expect(res.stats.updatedRows).toBe(1);
  });

  it('backfillShowMetaById обробляє по showId та повертає статистику', async () => {
    vi.mocked(db.execute).mockResolvedValue(undefined as any);
    vi.mocked(db.limit).mockResolvedValueOnce([
      {
        id: 1,
        tmdbId: 10,
        backdrop: null,
        genres: [],
        videos: [],
        cast: [],
        numberOfSeasons: null,
        numberOfEpisodes: null,
        latestSeasonNumber: null,
        latestSeasonEpisodes: null,
        lastEpisodeSeason: null,
        lastEpisodeNumber: null,
        lastEpisodeAirDate: null,
        nextEpisodeSeason: null,
        nextEpisodeNumber: null,
        nextEpisodeAirDate: null,
        status: null,
        tagline: null,
        firstAirDate: null,
        watchProviders: [],
        contentRating: null,
      },
    ] as any);
    vi.mocked(db.transaction).mockImplementationOnce(async (fn: any) => {
      const tx: any = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ traktId: null }]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      };
      await fn(tx);
    });
    vi.mocked(tmdbClient.getShowDetails).mockResolvedValue({ seasons: [] } as any);
    vi.mocked(tmdbClient.getShowVideos).mockResolvedValue({ results: [] } as any);
    vi.mocked(tmdbClient.getAggregateCredits).mockResolvedValue({ cast: [] } as any);
    vi.mocked(tmdbClient.getWatchProvidersByRegion).mockResolvedValue([] as any);
    vi.mocked(tmdbClient.getContentRatingByRegion).mockResolvedValue(null);
    const res = await backfillShowMetaById(1);
    expect(res.updated).toBe(1);
    expect(res.stats.processed).toBe(1);
    expect(res.stats.updatedRows).toBe(1);
  });
});
