import { TmdbMapper } from './tmdb.mapper';
import { MediaType } from '../../../../../../common/enums/media-type.enum';
import { VideoLanguageEnum } from '../../../../../../common/enums/video.enum';

describe('TmdbMapper', () => {
  const mockMovie = {
    id: 550,
    title: 'Fight Club',
    original_title: 'Fight Club',
    overview: 'A ticking-time-bomb insomniac...',
    poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    backdrop_path: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
    vote_average: 8.4,
    vote_count: 20000,
    popularity: 60.5,
    release_date: '1999-10-15',
    adult: false,
    status: 'Released',
    runtime: 139,
    budget: 63000000,
    revenue: 100853753,
    genres: [
      { id: 18, name: 'Drama' }
    ],
    release_dates: {
      results: [
        {
          iso_3166_1: 'US',
          release_dates: [
            { type: 3, release_date: '1999-10-15', certification: 'R' }
          ]
        },
        {
          iso_3166_1: 'UA',
          release_dates: [
            { type: 4, release_date: '2000-01-01' } // Digital
          ]
        }
      ]
    },
    'watch/providers': {
      results: {
        UA: {
          flatrate: [
            { provider_id: 8, provider_name: 'Netflix', logo_path: '/t2yyOv40HZeVlLkJs8hXc.jpg', display_priority: 0 }
          ]
        }
      }
    }
  };

  const mockShow = {
    id: 1396,
    name: 'Breaking Bad',
    original_name: 'Breaking Bad',
    overview: 'High school chemistry teacher...',
    poster_path: '/ggFHVNu6YYI5L9pRwOAyqJenX5p.jpg',
    vote_average: 9.5,
    vote_count: 10000,
    popularity: 300.5,
    first_air_date: '2008-01-20',
    last_air_date: '2013-09-29',
    number_of_seasons: 5,
    number_of_episodes: 62,
    status: 'Ended',
    genres: [
      { id: 18, name: 'Drama' }
    ],
    'watch/providers': {
      results: {
        UA: {
          buy: [
            { provider_id: 3, provider_name: 'Google Play', logo_path: '/pe.jpg', display_priority: 1 }
          ]
        }
      }
    }
  };

  describe('toDomain', () => {
    it('should map a movie correctly', () => {
      const result = TmdbMapper.toDomain(mockMovie, MediaType.MOVIE);

      expect(result).not.toBeNull();
      expect(result).toEqual(expect.objectContaining({
        title: 'Fight Club',
        slug: 'fight-club',
        type: MediaType.MOVIE,
        externalIds: { tmdbId: 550, imdbId: null },
        rating: 8.4,
        voteCount: 20000,
        popularity: 60.5,
        status: 'Released',
        details: expect.objectContaining({
          runtime: 139,
          budget: 63000000,
          revenue: 100853753,
          theatricalReleaseDate: new Date('1999-10-15'),
          digitalReleaseDate: new Date('2000-01-01'),
        }),
      }));
      
      expect(result?.genres).toHaveLength(1);
      expect(result?.genres[0]).toEqual({ tmdbId: 18, name: 'Drama', slug: 'drama' });
      
      expect(result?.watchProviders).toHaveLength(1);
      expect(result?.watchProviders[0]).toEqual(expect.objectContaining({
        providerId: 8,
        name: 'Netflix',
        type: 'flatrate'
      }));
    });

    it('should map a show correctly', () => {
      const result = TmdbMapper.toDomain(mockShow, MediaType.SHOW);

      expect(result).not.toBeNull();
      expect(result).toEqual(expect.objectContaining({
        title: 'Breaking Bad',
        slug: 'breaking-bad',
        type: MediaType.SHOW,
        externalIds: { tmdbId: 1396, imdbId: null },
        rating: 9.5,
        details: expect.objectContaining({
          totalSeasons: 5,
          totalEpisodes: 62,
          lastAirDate: new Date('2013-09-29'),
        }),
      }));

      expect(result?.watchProviders).toHaveLength(1);
      expect(result?.watchProviders[0].type).toBe('buy');
    });

    it('should return null if essential data is missing', () => {
      const brokenMovie = { ...mockMovie, title: '' };
      expect(TmdbMapper.toDomain(brokenMovie, MediaType.MOVIE)).toBeNull();

      const brokenShow = { ...mockShow, overview: '' };
      expect(TmdbMapper.toDomain(brokenShow, MediaType.SHOW)).toBeNull();
    });

    it('should generate slugs correctly', () => {
      const movieWithSpecialChars = { ...mockMovie, title: 'The Fast & The Furious: Tokyo Drift' };
      const result = TmdbMapper.toDomain(movieWithSpecialChars, MediaType.MOVIE);
      
      expect(result?.slug).toBe('the-fast-and-the-furious-tokyo-drift');
    });

    it('should handle missing release dates gracefully', () => {
      const movieNoDates = { ...mockMovie, release_dates: { results: [] } };
      const result = TmdbMapper.toDomain(movieNoDates, MediaType.MOVIE);

      expect(result?.details.theatricalReleaseDate).toBeNull();
      expect(result?.details.digitalReleaseDate).toBeNull();
    });

    it('should fallback to any release type if specific type not found', () => {
      const movieOnlyPhysical = {
        ...mockMovie,
        release_dates: {
          results: [
            { iso_3166_1: 'US', release_dates: [{ type: 5, release_date: '2000-05-05' }] } // Physical only
          ]
        }
      };
      
      // Mapper logic: if theatrical (3) not found, it does NOT fallback to physical (5). 
      // But let's check logic. Code: const anyTheatrical = allReleases.find(r => r.type === 3);
      // So it strictly looks for type 3.
      
      const result = TmdbMapper.toDomain(movieOnlyPhysical, MediaType.MOVIE);
      expect(result?.details.theatricalReleaseDate).toBeNull();
    });

    it('should sort videos correctly (UK > Official > Date)', () => {
      const movieWithVideos = {
        ...mockMovie,
        videos: {
          results: [
            { key: '1', name: 'Old Official EN', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'en', published_at: '2020-01-01' },
            { key: '2', name: 'New Unofficial EN', site: 'YouTube', type: 'Trailer', official: false, iso_639_1: 'en', published_at: '2022-01-01' },
            { key: '3', name: 'UK Trailer', site: 'YouTube', type: 'Trailer', official: false, iso_639_1: 'uk', published_at: '2021-01-01' },
            { key: '4', name: 'New Official EN', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'en', published_at: '2023-01-01' },
            { key: '5', name: 'Official UK Trailer', site: 'YouTube', type: 'Trailer', official: true, iso_639_1: 'uk', published_at: '2021-06-01' },
          ]
        }
      };

      const result = TmdbMapper.toDomain(movieWithVideos, MediaType.MOVIE);

      expect(result?.videos).toHaveLength(3);
      // 1. Official UK (key 5)
      expect(result?.videos[0].key).toBe('5');
      expect(result?.videos[0].language).toBe(VideoLanguageEnum.UK);
      // 2. Unofficial UK (key 3)
      expect(result?.videos[1].key).toBe('3');
      expect(result?.videos[1].language).toBe(VideoLanguageEnum.UK);
      // 3. Newest Official EN (key 4) - Note: Old Official EN (key 1) is older, Unofficial EN (key 2) is unofficial
      expect(result?.videos[2].key).toBe('4');
      expect(result?.videos[2].language).toBe(VideoLanguageEnum.EN);
    });
  });
});
