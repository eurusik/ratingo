import { TrendingShowsQuery } from './trending-shows.query';
import { ImageMapper } from '../mappers/image.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

const dateFrom = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
};

describe('TrendingShowsQuery', () => {
  let db: any;
  let query: TrendingShowsQuery;

  beforeEach(() => {
    db = { execute: jest.fn() };
    query = new TrendingShowsQuery(db as any);

    jest.spyOn(ImageMapper, 'toPoster').mockReturnValue({ small: 'poster' } as any);
    jest.spyOn(ImageMapper, 'toBackdrop').mockReturnValue({ small: 'backdrop' } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should map trending shows with progress and flags', async () => {
    const rows = [
      {
        id: 'm1',
        tmdb_id: 1,
        title: 'Show',
        original_title: 'Orig',
        slug: 'show',
        overview: 'ov',
        poster_path: '/p.jpg',
        backdrop_path: '/b.jpg',
        release_date: dateFrom(-5),
        videos: [{ key: 'trailer1' }],
        ingestion_status: 'done',
        rating: 8,
        vote_count: 1000,
        rating_imdb: 7,
        vote_count_imdb: 900,
        rating_trakt: 8,
        vote_count_trakt: 800,
        rating_metacritic: 70,
        rating_rotten_tomatoes: 85,
        popularity: 50,
        ratingo_score: 90,
        quality_score: 0.8,
        popularity_score: 0.9,
        watchers_count: 5,
        total_watchers: 20000,
        last_air_date: dateFrom(-1),
        next_air_date: dateFrom(10),
        season_number: 3,
        episode_number: 5,
      },
      {
        id: 'm2',
        tmdb_id: 2,
        title: 'Old Show',
        original_title: null,
        slug: 'old',
        overview: null,
        poster_path: '/p2.jpg',
        backdrop_path: '/b2.jpg',
        release_date: new Date(new Date().getFullYear() - 12, 0, 1),
        videos: [],
        ingestion_status: 'done',
        rating: 7,
        vote_count: 500,
        ratingo_score: 60,
        quality_score: 0.6,
        popularity_score: 0.5,
        watchers_count: 1,
        total_watchers: 100,
        last_air_date: null,
        next_air_date: null,
        season_number: null,
        episode_number: null,
      },
    ];

    db.execute.mockResolvedValue(rows);

    const res = await query.execute({ limit: 10, offset: 0, minRating: 50 });

    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(res).toHaveLength(2);

    const first = res.find(r => r.id === 'm1')!;
    expect(first.isNew).toBe(true);
    expect(first.isClassic).toBe(true); // ratingoScore + watchers triggers classic
    expect(first.primaryTrailerKey).toBe('trailer1');
    expect(first.showProgress?.label).toBe('S3E5');
    expect(first.poster).toEqual({ small: 'poster' });

    const second = res.find(r => r.id === 'm2')!;
    expect(second.isClassic).toBe(true);
    expect(second.showProgress?.label).toBeNull();
  });

  it('should return empty array when no results', async () => {
    db.execute.mockResolvedValue([]);
    const res = await query.execute({});
    expect(res).toEqual([]);
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('should throw DatabaseException on error', async () => {
    db.execute.mockRejectedValue(new Error('DB error'));
    await expect(query.execute({})).rejects.toThrow(DatabaseException);
  });
});
