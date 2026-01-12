import { NewEpisodesQuery } from './new-episodes.query';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

describe('NewEpisodesQuery', () => {
  let query: NewEpisodesQuery;
  let db: any;

  /**
   * Setup mock DB with execute returning raw rows (snake_case).
   * The query uses DISTINCT ON so results are already grouped by show.
   *
   * Note: The actual SQL query filters by:
   * - Episodes aired within the date range
   * - Shows that are ELIGIBLE in TRENDING context (media_catalog_evaluations)
   * - Shows that pass trending hard gate (freshness_score >= 50 OR watchers_count >= 10)
   *
   * These tests mock the DB response to test result mapping, not SQL logic.
   */
  const setup = (resolveWith: any[] = [], rejectWith?: Error) => {
    if (rejectWith) {
      db = {
        execute: jest.fn().mockRejectedValue(rejectWith),
      };
    } else {
      db = {
        execute: jest.fn().mockResolvedValue(resolveWith),
      };
    }
    query = new NewEpisodesQuery(db as any);
  };

  /** Convert camelCase test data to snake_case DB rows */
  const toDbRow = (item: any) => ({
    media_item_id: item.mediaItemId,
    slug: item.slug,
    title: item.title,
    poster_path: item.posterPath,
    season_number: item.seasonNumber,
    episode_number: item.episodeNumber,
    episode_title: item.episodeTitle,
    air_date: item.airDate,
  });

  it('should return new episodes grouped by show', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // DISTINCT ON returns one row per show (already grouped)
    const dbRows = [
      toDbRow({
        mediaItemId: 'show1',
        slug: 'breaking-bad',
        title: 'Breaking Bad',
        posterPath: '/bb.jpg',
        seasonNumber: 5,
        episodeNumber: 16,
        episodeTitle: 'Felina',
        airDate: now,
      }),
      toDbRow({
        mediaItemId: 'show2',
        slug: 'better-call-saul',
        title: 'Better Call Saul',
        posterPath: '/bcs.jpg',
        seasonNumber: 6,
        episodeNumber: 13,
        episodeTitle: 'Saul Gone',
        airDate: yesterday,
      }),
    ];

    setup(dbRows);

    const result = await query.execute(7, 10);

    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);

    // First show - latest episode
    expect(result[0].mediaItemId).toBe('show1');
    expect(result[0].episodeNumber).toBe(16);
    expect(result[0].episodeTitle).toBe('Felina');

    // Second show
    expect(result[1].mediaItemId).toBe('show2');
    expect(result[1].episodeNumber).toBe(13);
  });

  it('should respect limit parameter', async () => {
    const dbRows = [
      toDbRow({
        mediaItemId: 'show1',
        slug: 's1',
        title: 'Show 1',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Ep1',
        airDate: new Date(),
      }),
      toDbRow({
        mediaItemId: 'show2',
        slug: 's2',
        title: 'Show 2',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Ep1',
        airDate: new Date(),
      }),
    ];

    setup(dbRows);

    const result = await query.execute(7, 2);

    expect(result).toHaveLength(2);
    expect(result[0].mediaItemId).toBe('show1');
    expect(result[1].mediaItemId).toBe('show2');
  });

  it('should return empty array when no episodes found', async () => {
    setup([]);

    const result = await query.execute(7, 20);

    expect(result).toEqual([]);
  });

  it('should use default values when not provided', async () => {
    setup([]);

    await query.execute();

    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('should throw DatabaseException on error', async () => {
    setup([], new Error('DB Error'));

    await expect(query.execute()).rejects.toThrow(DatabaseException);
  });

  it('should fallback to Episode N when episodeTitle is null', async () => {
    const dbRows = [
      toDbRow({
        mediaItemId: 'show1',
        slug: 's1',
        title: 'Show 1',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 5,
        episodeTitle: null,
        airDate: new Date(),
      }),
    ];

    setup(dbRows);

    const result = await query.execute();

    expect(result[0].episodeTitle).toBe('Episode 5');
  });

  it('should return highest episode number when batch release (same airDate)', async () => {
    // DISTINCT ON with ORDER BY show_id, air_date DESC, number DESC
    // returns the highest episode number for each show
    const batchReleaseDate = new Date();

    // DB already returns grouped result with highest episode
    const dbRows = [
      toDbRow({
        mediaItemId: 'show1',
        slug: 'you-and-me',
        title: 'You & Me',
        posterPath: '/yam.jpg',
        seasonNumber: 1,
        episodeNumber: 6, // Highest episode returned by DISTINCT ON
        episodeTitle: 'Episode 6',
        airDate: batchReleaseDate,
      }),
    ];

    setup(dbRows);

    const result = await query.execute();

    // Should have episode 6 (highest number) from DISTINCT ON
    expect(result).toHaveLength(1);
    expect(result[0].mediaItemId).toBe('show1');
    expect(result[0].episodeNumber).toBe(6);
    expect(result[0].episodeTitle).toBe('Episode 6');
  });

  it('should handle {rows: []} response format from drizzle', async () => {
    const dbRows = [
      toDbRow({
        mediaItemId: 'show1',
        slug: 's1',
        title: 'Show 1',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        episodeTitle: 'Ep1',
        airDate: new Date(),
      }),
    ];

    // Some drizzle versions return {rows: [...]} instead of [...]
    db = {
      execute: jest.fn().mockResolvedValue({ rows: dbRows }),
    };
    query = new NewEpisodesQuery(db as any);

    const result = await query.execute();

    expect(result).toHaveLength(1);
    expect(result[0].mediaItemId).toBe('show1');
  });
});
