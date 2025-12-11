import { PersistenceMapper } from './persistence.mapper';
import { MediaType } from '../../../../common/enums/media-type.enum';

const baseMedia = {
  type: MediaType.MOVIE,
  externalIds: { tmdbId: 1, imdbId: 'tt1' },
  title: 'Title',
  originalTitle: 'Original',
  slug: 'title',
  overview: 'overview',
  posterPath: '/p.jpg',
  backdropPath: '/b.jpg',
  videos: null,
  credits: null,
  watchProviders: null,
  rating: 8,
  voteCount: 100,
  popularity: 200,
  trendingScore: undefined,
  ratingImdb: 7.5,
  ratingTrakt: 8,
  ratingMetacritic: 70,
  ratingRottenTomatoes: 90,
  voteCountImdb: 1000,
  voteCountTrakt: 500,
  releaseDate: new Date('2020-01-01'),
  ratingoScore: 0.8,
  qualityScore: 0.7,
  popularityScore: 0.9,
  freshnessScore: 0.6,
  watchersCount: 10,
  totalWatchers: 20,
  genres: [],
  details: {},
};

describe('PersistenceMapper', () => {
  it('toMediaItemInsert should map fields and set defaults', () => {
    const res = PersistenceMapper.toMediaItemInsert(baseMedia as any);
    expect(res).toMatchObject({
      type: MediaType.MOVIE,
      tmdbId: 1,
      imdbId: 'tt1',
      title: 'Title',
      originalTitle: 'Original',
      slug: 'title',
      overview: 'overview',
      posterPath: '/p.jpg',
      backdropPath: '/b.jpg',
      rating: 8,
      voteCount: 100,
      popularity: 200,
      trendingScore: 0, // default when undefined
      ratingImdb: 7.5,
      voteCountImdb: 1000,
      ratingTrakt: 8,
      voteCountTrakt: 500,
      ratingMetacritic: 70,
      ratingRottenTomatoes: 90,
      releaseDate: new Date('2020-01-01'),
    });
    expect(res.updatedAt).toBeInstanceOf(Date);
  });

  it('toMediaItemUpdate should omit trendingScore when undefined', () => {
    const res = PersistenceMapper.toMediaItemUpdate(baseMedia as any);
    expect(res).not.toHaveProperty('trendingScore');
    const withTrending = PersistenceMapper.toMediaItemUpdate({
      ...baseMedia,
      trendingScore: 1,
    } as any);
    expect(withTrending.trendingScore).toBe(1);
  });

  it('toMediaStatsInsert should return null when ratingoScore undefined', () => {
    const resNull = PersistenceMapper.toMediaStatsInsert('m1', {
      ...baseMedia,
      ratingoScore: undefined,
    } as any);
    expect(resNull).toBeNull();
    const res = PersistenceMapper.toMediaStatsInsert('m1', baseMedia as any)!;
    expect(res).toMatchObject({
      mediaItemId: 'm1',
      ratingoScore: 0.8,
      qualityScore: 0.7,
      popularityScore: 0.9,
      freshnessScore: 0.6,
      watchersCount: 10,
      totalWatchers: 20,
    });
    expect(res.updatedAt).toBeInstanceOf(Date);
  });

  it('toMovieInsert/toMovieUpdate should map fields', () => {
    const details = {
      runtime: 120,
      budget: 1000,
      revenue: 5000,
      status: 'Released',
      theatricalReleaseDate: new Date('2020-01-02'),
      digitalReleaseDate: new Date('2020-02-01'),
      releases: [{ country: 'US' }],
    } as any;
    expect(PersistenceMapper.toMovieInsert('mid', details)).toMatchObject({
      mediaItemId: 'mid',
      runtime: 120,
      budget: 1000,
      revenue: 5000,
      status: 'Released',
    });
    expect(PersistenceMapper.toMovieUpdate(details)).toMatchObject({
      runtime: 120,
      budget: 1000,
      revenue: 5000,
      status: 'Released',
    });
  });

  it('toShowInsert/toShowUpdate should map fields', () => {
    const details = {
      totalSeasons: 2,
      totalEpisodes: 10,
      lastAirDate: new Date('2021-01-01'),
      nextAirDate: new Date('2022-01-01'),
      status: 'Ended',
    } as any;
    expect(PersistenceMapper.toShowInsert('mid', details)).toMatchObject({
      mediaItemId: 'mid',
      totalSeasons: 2,
      totalEpisodes: 10,
      status: 'Ended',
    });
    expect(PersistenceMapper.toShowUpdate(details)).toMatchObject({
      totalSeasons: 2,
      totalEpisodes: 10,
      status: 'Ended',
    });
  });

  it('toSeasonInsert/toSeasonUpdate should map fields', () => {
    const season = {
      tmdbId: 11,
      number: 1,
      name: 'S1',
      overview: 'O',
      posterPath: '/s.jpg',
      airDate: new Date('2020-01-01'),
      episodeCount: 5,
    } as any;
    expect(PersistenceMapper.toSeasonInsert('show1', season)).toMatchObject({
      showId: 'show1',
      tmdbId: 11,
      number: 1,
    });
    expect(PersistenceMapper.toSeasonUpdate(season)).toMatchObject({
      tmdbId: 11,
      name: 'S1',
    });
  });

  it('toEpisodeInsert/toEpisodeUpdate should map fields', () => {
    const ep = {
      tmdbId: 101,
      number: 1,
      title: 'Ep1',
      overview: 'O',
      airDate: new Date('2020-01-02'),
      runtime: 45,
      stillPath: '/e.jpg',
      rating: 9,
    } as any;
    expect(PersistenceMapper.toEpisodeInsert('season1', 'show1', ep)).toMatchObject({
      seasonId: 'season1',
      showId: 'show1',
      tmdbId: 101,
      number: 1,
      title: 'Ep1',
    });
    expect(PersistenceMapper.toEpisodeUpdate(ep)).toMatchObject({
      tmdbId: 101,
      title: 'Ep1',
    });
  });
});
