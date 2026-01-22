import { toScoreInput } from './score-input.mapper';
import { type MediaScoreDataWithTmdbId } from '../../../catalog/public';

describe('toScoreInput', () => {
  const createScoreData = (
    overrides: Partial<MediaScoreDataWithTmdbId> = {},
  ): MediaScoreDataWithTmdbId => ({
    id: 'media-1',
    tmdbId: 550,
    popularity: 85.5,
    totalWatchers: 10000,
    watchersCount: 500,
    ratingImdb: 8.5,
    ratingTrakt: 8.2,
    ratingMetacritic: 75,
    ratingRottenTomatoes: 88,
    voteCountImdb: 25000,
    voteCountTrakt: 5000,
    releaseDate: new Date('2024-01-15'),
    lastAirDate: null,
    ...overrides,
  });

  it('should map all fields correctly', () => {
    const scoreData = createScoreData();

    const result = toScoreInput(scoreData);

    expect(result).toEqual({
      tmdbPopularity: 85.5,
      traktTotalWatchers: 10000,
      traktLiveWatchers: 500,
      imdbRating: 8.5,
      traktRating: 8.2,
      metacriticRating: 75,
      rottenTomatoesRating: 88,
      imdbVotes: 25000,
      traktVotes: 5000,
      releaseDate: new Date('2024-01-15'),
      lastAirDate: null,
    });
  });

  it('should use liveWatchers parameter when provided', () => {
    const scoreData = createScoreData({ watchersCount: 500 });

    const result = toScoreInput(scoreData, 1500);

    expect(result.traktLiveWatchers).toBe(1500);
  });

  it('should use scoreData.watchersCount when liveWatchers is undefined', () => {
    const scoreData = createScoreData({ watchersCount: 750 });

    const result = toScoreInput(scoreData, undefined);

    expect(result.traktLiveWatchers).toBe(750);
  });

  it('should use scoreData.watchersCount when liveWatchers is null', () => {
    const scoreData = createScoreData({ watchersCount: 750 });

    const result = toScoreInput(scoreData, null);

    expect(result.traktLiveWatchers).toBe(750);
  });

  it('should default totalWatchers to 0 when null', () => {
    const scoreData = createScoreData({ totalWatchers: null });

    const result = toScoreInput(scoreData);

    expect(result.traktTotalWatchers).toBe(0);
  });

  it('should handle null ratings', () => {
    const scoreData = createScoreData({
      ratingImdb: null,
      ratingTrakt: null,
      ratingMetacritic: null,
      ratingRottenTomatoes: null,
    });

    const result = toScoreInput(scoreData);

    expect(result.imdbRating).toBeNull();
    expect(result.traktRating).toBeNull();
    expect(result.metacriticRating).toBeNull();
    expect(result.rottenTomatoesRating).toBeNull();
  });

  it('should handle null vote counts', () => {
    const scoreData = createScoreData({
      voteCountImdb: null,
      voteCountTrakt: null,
    });

    const result = toScoreInput(scoreData);

    expect(result.imdbVotes).toBeNull();
    expect(result.traktVotes).toBeNull();
  });

  it('should handle show with lastAirDate', () => {
    const scoreData = createScoreData({
      releaseDate: new Date('2020-01-01'),
      lastAirDate: new Date('2024-06-15'),
    });

    const result = toScoreInput(scoreData);

    expect(result.releaseDate).toEqual(new Date('2020-01-01'));
    expect(result.lastAirDate).toEqual(new Date('2024-06-15'));
  });

  it('should allow zero values for watchers', () => {
    const scoreData = createScoreData({
      totalWatchers: 0,
      watchersCount: 0,
    });

    const result = toScoreInput(scoreData, 0);

    expect(result.traktTotalWatchers).toBe(0);
    expect(result.traktLiveWatchers).toBe(0);
  });
});
