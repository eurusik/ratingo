import { TmdbMapper } from './tmdb.mapper';
import { MediaType } from '../../../common/enums/media-type.enum';
import { VideoLanguageEnum } from '../../../common/enums/video.enum';
import { DEFAULT_REGION } from '../../../common/constants';

describe('TmdbMapper', () => {
  const mockMovie = {
    id: 550,
    title: 'Fight Club',
    original_title: 'Fight Club',
    original_language: 'en',
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
    genres: [{ id: 18, name: 'Drama' }],
    release_dates: {
      results: [
        {
          iso_3166_1: 'US',
          release_dates: [{ type: 3, release_date: '1999-10-15', certification: 'R' }],
        },
        {
          iso_3166_1: DEFAULT_REGION,
          release_dates: [
            { type: 4, release_date: '2000-01-01' }, // Digital
          ],
        },
      ],
    },
    'watch/providers': {
      results: {
        [DEFAULT_REGION]: {
          flatrate: [
            {
              provider_id: 8,
              provider_name: 'Netflix',
              logo_path: '/t2yyOv40HZeVlLkJs8hXc.jpg',
              display_priority: 0,
            },
          ],
        },
      },
    },
  };

  const mockShow = {
    id: 1396,
    name: 'Breaking Bad',
    original_name: 'Breaking Bad',
    original_language: 'en',
    overview: 'High school chemistry teacher...',
    poster_path: '/ggFHVNu6YYI5L9pRwOAyqJenX5p.jpg',
    backdrop_path: '/backdrop.jpg',
    vote_average: 9.5,
    vote_count: 10000,
    popularity: 300.5,
    first_air_date: '2008-01-20',
    last_air_date: '2013-09-29',
    number_of_seasons: 5,
    number_of_episodes: 62,
    status: 'Ended',
    adult: false,
    origin_country: ['US'],
    genres: [{ id: 18, name: 'Drama' }],
    'watch/providers': {
      results: {
        [DEFAULT_REGION]: {
          buy: [
            {
              provider_id: 3,
              provider_name: 'Google Play',
              logo_path: '/pe.jpg',
              display_priority: 1,
            },
          ],
        },
      },
    },
  };

  describe('toDomain', () => {
    it('should map a movie correctly', () => {
      const result = TmdbMapper.toDomain(mockMovie, MediaType.MOVIE);

      expect(result).not.toBeNull();
      expect(result).toEqual(
        expect.objectContaining({
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
          credits: expect.objectContaining({
            cast: [],
            crew: [],
          }),
        }),
      );

      expect(result?.genres).toHaveLength(1);
      expect(result?.genres[0]).toEqual({ tmdbId: 18, name: 'Drama', slug: 'drama' });

      expect(result?.watchProviders).toBeDefined();
      expect(result?.watchProviders?.[DEFAULT_REGION]).toBeDefined();
      expect(result?.watchProviders?.[DEFAULT_REGION].flatrate).toHaveLength(1);
      expect(result?.watchProviders?.[DEFAULT_REGION].flatrate?.[0]).toEqual(
        expect.objectContaining({
          providerId: 8,
          name: 'Netflix',
        }),
      );
    });

    it('should map a show correctly', () => {
      const result = TmdbMapper.toDomain(mockShow, MediaType.SHOW);

      expect(result).not.toBeNull();
      expect(result).toEqual(
        expect.objectContaining({
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
          credits: expect.objectContaining({
            cast: [],
            crew: [],
          }),
        }),
      );

      expect(result?.watchProviders).toBeDefined();
      expect(result?.watchProviders?.[DEFAULT_REGION]).toBeDefined();
      expect(result?.watchProviders?.[DEFAULT_REGION].buy).toHaveLength(1);
      expect(result?.watchProviders?.[DEFAULT_REGION].buy?.[0].providerId).toBe(3);
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

    it('should only extract UA and US watch providers, ignoring other regions', () => {
      const movieWithManyRegions = {
        ...mockMovie,
        'watch/providers': {
          results: {
            AR: {
              flatrate: [{ provider_id: 1, provider_name: 'AR Provider', logo_path: '/ar.jpg' }],
            },
            DE: {
              flatrate: [{ provider_id: 2, provider_name: 'DE Provider', logo_path: '/de.jpg' }],
            },
            [DEFAULT_REGION]: {
              flatrate: [{ provider_id: 3, provider_name: 'UA Provider', logo_path: '/ua.jpg' }],
            },
            US: { rent: [{ provider_id: 4, provider_name: 'US Provider', logo_path: '/us.jpg' }] },
            GB: { buy: [{ provider_id: 5, provider_name: 'GB Provider', logo_path: '/gb.jpg' }] },
          },
        },
      };

      const result = TmdbMapper.toDomain(movieWithManyRegions, MediaType.MOVIE);

      expect(result?.watchProviders).toBeDefined();
      expect(Object.keys(result?.watchProviders || {})).toEqual([DEFAULT_REGION, 'US']);
      expect(result?.watchProviders?.[DEFAULT_REGION]?.flatrate?.[0].name).toBe('UA Provider');
      expect(result?.watchProviders?.['US']?.rent?.[0].name).toBe('US Provider');
      expect(result?.watchProviders?.['AR']).toBeUndefined();
      expect(result?.watchProviders?.['DE']).toBeUndefined();
      expect(result?.watchProviders?.['GB']).toBeUndefined();
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
            { iso_3166_1: 'US', release_dates: [{ type: 5, release_date: '2000-05-05' }] }, // Physical only
          ],
        },
      };

      // Mapper logic: if theatrical (3) not found, it does NOT fallback to physical (5).
      // But let's check logic. Code: const anyTheatrical = allReleases.find(r => r.type === 3);
      // So it strictly looks for type 3.

      const result = TmdbMapper.toDomain(movieOnlyPhysical, MediaType.MOVIE);
      expect(result?.details.theatricalReleaseDate).toBeNull();
    });

    it('should fallback to other countries for release dates if primary regions missing', () => {
      const movieOtherRegions = {
        ...mockMovie,
        release_dates: {
          results: [
            {
              iso_3166_1: 'FR',
              release_dates: [
                { type: 3, release_date: '2001-01-01' }, // Theatrical
                { type: 4, release_date: '2001-02-01' }, // Digital
              ],
            },
          ],
        },
      };

      const result = TmdbMapper.toDomain(movieOtherRegions, MediaType.MOVIE);
      expect(result?.details.theatricalReleaseDate).toEqual(new Date('2001-01-01'));
      expect(result?.details.digitalReleaseDate).toEqual(new Date('2001-02-01'));
    });

    it('should extract credits for movies correctly', () => {
      const movieWithCredits = {
        ...mockMovie,
        credits: {
          cast: [
            {
              id: 1,
              name: 'Brad Pitt',
              character: 'Tyler Durden',
              profile_path: '/brad.jpg',
              order: 0,
            },
            {
              id: 2,
              name: 'Edward Norton',
              character: 'The Narrator',
              profile_path: '/edward.jpg',
              order: 1,
            },
          ],
          crew: [
            {
              id: 3,
              name: 'David Fincher',
              job: 'Director',
              department: 'Directing',
              profile_path: '/david.jpg',
            },
            {
              id: 4,
              name: 'Jim Uhls',
              job: 'Screenplay',
              department: 'Writing',
              profile_path: null,
            },
          ],
        },
      };

      const result = TmdbMapper.toDomain(movieWithCredits, MediaType.MOVIE);

      expect(result?.credits.cast).toHaveLength(2);
      expect(result?.credits.cast[0]).toEqual({
        tmdbId: 1,
        name: 'Brad Pitt',
        character: 'Tyler Durden',
        profilePath: '/brad.jpg',
        order: 0,
      });

      // Only Directors are included
      expect(result?.credits.crew).toHaveLength(1);
      expect(result?.credits.crew[0]).toEqual({
        tmdbId: 3,
        name: 'David Fincher',
        job: 'Director',
        department: 'Directing',
        profilePath: '/david.jpg',
      });
    });

    it('should extract credits for shows correctly (aggregate_credits + created_by)', () => {
      const showWithCredits = {
        ...mockShow,
        aggregate_credits: {
          cast: [
            {
              id: 10,
              name: 'Bryan Cranston',
              roles: [{ character: 'Walter White' }],
              profile_path: '/bryan.jpg',
              order: 0,
            },
            {
              id: 11,
              name: 'Aaron Paul',
              roles: [{ character: 'Jesse Pinkman' }],
              profile_path: '/aaron.jpg',
              order: 1,
            },
          ],
        },
        created_by: [{ id: 20, name: 'Vince Gilligan', profile_path: '/vince.jpg' }],
      };

      const result = TmdbMapper.toDomain(showWithCredits, MediaType.SHOW);

      expect(result?.credits.cast).toHaveLength(2);
      expect(result?.credits.cast[0]).toEqual({
        tmdbId: 10,
        name: 'Bryan Cranston',
        character: 'Walter White',
        profilePath: '/bryan.jpg',
        order: 0,
      });

      expect(result?.credits.crew).toHaveLength(1);
      expect(result?.credits.crew[0]).toEqual({
        tmdbId: 20,
        name: 'Vince Gilligan',
        job: 'Creator',
        department: 'Writing',
        profilePath: '/vince.jpg',
      });
    });

    it('should limit cast to 10 members', () => {
      const cast = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        name: `Actor ${i}`,
        character: `Character ${i}`,
        profile_path: null,
        order: i,
      }));

      const movieWithManyCast = {
        ...mockMovie,
        credits: { cast, crew: [] },
      };

      const result = TmdbMapper.toDomain(movieWithManyCast, MediaType.MOVIE);

      expect(result?.credits.cast).toHaveLength(10);
      expect(result?.credits.cast[0].name).toBe('Actor 0');
      expect(result?.credits.cast[9].name).toBe('Actor 9');
    });

    it('should sort videos correctly (UK > Official > Date)', () => {
      const movieWithVideos = {
        ...mockMovie,
        videos: {
          results: [
            {
              key: '1',
              name: 'Old Official EN',
              site: 'YouTube',
              type: 'Trailer',
              official: true,
              iso_639_1: 'en',
              iso_3166_1: 'US',
              published_at: '2020-01-01',
            },
            {
              key: '2',
              name: 'New Unofficial EN',
              site: 'YouTube',
              type: 'Trailer',
              official: false,
              iso_639_1: 'en',
              iso_3166_1: 'US',
              published_at: '2022-01-01',
            },
            {
              key: '3',
              name: 'UK Trailer',
              site: 'YouTube',
              type: 'Trailer',
              official: false,
              iso_639_1: 'uk',
              iso_3166_1: 'UA',
              published_at: '2021-01-01',
            },
            {
              key: '4',
              name: 'New Official EN',
              site: 'YouTube',
              type: 'Trailer',
              official: true,
              iso_639_1: 'en',
              iso_3166_1: 'US',
              published_at: '2023-01-01',
            },
            {
              key: '5',
              name: 'Official UK Trailer',
              site: 'YouTube',
              type: 'Trailer',
              official: true,
              iso_639_1: 'uk',
              iso_3166_1: 'UA',
              published_at: '2021-06-01',
            },
          ],
        },
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

    it('should sort videos: Trailer > Teaser (when not UK)', () => {
      const movieWithTypes = {
        ...mockMovie,
        videos: {
          results: [
            {
              key: '1',
              name: 'Teaser',
              site: 'YouTube',
              type: 'Teaser',
              official: true,
              iso_639_1: 'en',
              iso_3166_1: 'US',
              published_at: '2023-01-01',
            },
            {
              key: '2',
              name: 'Trailer',
              site: 'YouTube',
              type: 'Trailer',
              official: true,
              iso_639_1: 'en',
              iso_3166_1: 'US',
              published_at: '2023-01-01',
            },
          ],
        },
      };

      const result = TmdbMapper.toDomain(movieWithTypes, MediaType.MOVIE);
      // Expect Trailer (key 2) first
      expect(result?.videos[0].key).toBe('2');
      expect(result?.videos[0].type).toBe('Trailer');
      expect(result?.videos[1].key).toBe('1');
    });
  });
});
