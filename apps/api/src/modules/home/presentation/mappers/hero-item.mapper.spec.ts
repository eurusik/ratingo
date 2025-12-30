import { HeroItemMapper } from './hero-item.mapper';
import { HeroMediaItem } from '../../../catalog/domain/models/hero-media.model';
import { MediaType } from '../../../../common/enums/media-type.enum';

describe('HeroItemMapper', () => {
  const createMockHeroItem = (overrides: Partial<HeroMediaItem> = {}): HeroMediaItem => ({
    id: '123',
    mediaItemId: '123',
    type: MediaType.MOVIE,
    slug: 'fight-club',
    title: 'Fight Club',
    originalTitle: 'Fight Club',
    overview: 'An insomniac office worker...',
    primaryTrailerKey: 'abc123',
    poster: { small: 'ps', medium: 'pm', large: 'pl', original: 'po' },
    backdrop: { small: 'bs', medium: 'bm', large: 'bl', original: 'bo' },
    releaseDate: new Date('1999-10-15'),
    isNew: false,
    isClassic: true,
    stats: {
      ratingoScore: 85.5,
      qualityScore: 88.5,
      popularityScore: 75.0,
      liveWatchers: 100,
      totalWatchers: 5000,
    },
    externalRatings: {
      tmdb: { rating: 8.4, voteCount: 20000 },
      imdb: { rating: 8.8, voteCount: 1500000 },
      trakt: { rating: 8.5, voteCount: 50000 },
      metacritic: { rating: 75 },
      rottenTomatoes: { rating: 85 },
    },
    ...overrides,
  });

  describe('toDto', () => {
    it('should map all basic fields correctly', () => {
      const item = createMockHeroItem();

      const dto = HeroItemMapper.toDto(item);

      expect(dto.id).toBe('123');
      expect(dto.mediaItemId).toBe('123');
      expect(dto.type).toBe(MediaType.MOVIE);
      expect(dto.slug).toBe('fight-club');
      expect(dto.title).toBe('Fight Club');
      expect(dto.originalTitle).toBe('Fight Club');
      expect(dto.overview).toBe('An insomniac office worker...');
      expect(dto.primaryTrailerKey).toBe('abc123');
      expect(dto.isNew).toBe(false);
      expect(dto.isClassic).toBe(true);
    });

    it('should map images correctly', () => {
      const item = createMockHeroItem();

      const dto = HeroItemMapper.toDto(item);

      expect(dto.poster).toEqual({ small: 'ps', medium: 'pm', large: 'pl', original: 'po' });
      expect(dto.backdrop).toEqual({ small: 'bs', medium: 'bm', large: 'bl', original: 'bo' });
    });

    it('should handle null images', () => {
      const item = createMockHeroItem({ poster: null, backdrop: null });

      const dto = HeroItemMapper.toDto(item);

      expect(dto.poster).toEqual({ small: '', medium: '', large: '', original: '' });
      expect(dto.backdrop).toEqual({ small: '', medium: '', large: '', original: '' });
    });

    it('should map stats correctly', () => {
      const item = createMockHeroItem();

      const dto = HeroItemMapper.toDto(item);

      expect(dto.stats.ratingoScore).toBe(85.5);
      expect(dto.stats.qualityScore).toBe(88.5);
      expect(dto.stats.liveWatchers).toBe(100);
      expect(dto.stats.totalWatchers).toBe(5000);
    });

    it('should handle null stats values', () => {
      const item = createMockHeroItem({
        stats: {
          ratingoScore: null,
          qualityScore: null,
          popularityScore: null,
          liveWatchers: null,
          totalWatchers: null,
        },
      });

      const dto = HeroItemMapper.toDto(item);

      expect(dto.stats.ratingoScore).toBe(0);
      expect(dto.stats.qualityScore).toBe(0);
      expect(dto.stats.liveWatchers).toBeUndefined();
      expect(dto.stats.totalWatchers).toBeUndefined();
    });

    it('should map all external ratings', () => {
      const item = createMockHeroItem();

      const dto = HeroItemMapper.toDto(item);

      expect(dto.externalRatings?.tmdb).toEqual({ rating: 8.4, voteCount: 20000 });
      expect(dto.externalRatings?.imdb).toEqual({ rating: 8.8, voteCount: 1500000 });
      expect(dto.externalRatings?.trakt).toEqual({ rating: 8.5, voteCount: 50000 });
      expect(dto.externalRatings?.metacritic).toEqual({ rating: 75 });
      expect(dto.externalRatings?.rottenTomatoes).toEqual({ rating: 85 });
    });

    it('should handle null external ratings', () => {
      const item = createMockHeroItem({
        externalRatings: {
          tmdb: null,
          imdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      });

      const dto = HeroItemMapper.toDto(item);

      expect(dto.externalRatings?.tmdb).toBeUndefined();
      expect(dto.externalRatings?.imdb).toBeUndefined();
      expect(dto.externalRatings?.trakt).toBeUndefined();
      expect(dto.externalRatings?.metacritic).toBeUndefined();
      expect(dto.externalRatings?.rottenTomatoes).toBeUndefined();
    });

    it('should use title as originalTitle fallback when null', () => {
      const item = createMockHeroItem({ originalTitle: null });

      const dto = HeroItemMapper.toDto(item);

      expect(dto.originalTitle).toBe('Fight Club');
    });

    it('should map show progress for TV shows', () => {
      const item = createMockHeroItem({
        type: MediaType.SHOW,
        showProgress: {
          season: 5,
          episode: 10,
          label: 'S5E10',
          lastAirDate: new Date('2024-12-01'),
          nextAirDate: new Date('2024-12-08'),
        },
      });

      const dto = HeroItemMapper.toDto(item);

      expect(dto.showProgress).toBeDefined();
      expect(dto.showProgress?.season).toBe(5);
      expect(dto.showProgress?.episode).toBe(10);
      expect(dto.showProgress?.label).toBe('S5E10');
      expect(dto.showProgress?.lastAirDate).toEqual(new Date('2024-12-01'));
      expect(dto.showProgress?.nextAirDate).toEqual(new Date('2024-12-08'));
    });

    it('should handle null show progress values', () => {
      const item = createMockHeroItem({
        type: MediaType.SHOW,
        showProgress: {
          season: null,
          episode: null,
          label: null,
          lastAirDate: null,
          nextAirDate: null,
        },
      });

      const dto = HeroItemMapper.toDto(item);

      expect(dto.showProgress?.season).toBe(0);
      expect(dto.showProgress?.episode).toBe(0);
      expect(dto.showProgress?.label).toBe('');
      expect(dto.showProgress?.lastAirDate).toBeUndefined();
      expect(dto.showProgress?.nextAirDate).toBeUndefined();
    });

    it('should not include showProgress for movies', () => {
      const item = createMockHeroItem({ type: MediaType.MOVIE, showProgress: undefined });

      const dto = HeroItemMapper.toDto(item);

      expect(dto.showProgress).toBeUndefined();
    });
  });

  describe('toDtoList', () => {
    it('should map multiple items', () => {
      const items = [
        createMockHeroItem({ id: '1', title: 'Movie 1' }),
        createMockHeroItem({ id: '2', title: 'Movie 2' }),
      ];

      const dtos = HeroItemMapper.toDtoList(items);

      expect(dtos).toHaveLength(2);
      expect(dtos[0].id).toBe('1');
      expect(dtos[1].id).toBe('2');
    });

    it('should return empty array for empty input', () => {
      const dtos = HeroItemMapper.toDtoList([]);

      expect(dtos).toEqual([]);
    });
  });
});
