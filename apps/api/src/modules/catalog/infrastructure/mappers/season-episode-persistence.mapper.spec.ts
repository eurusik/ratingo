import { SeasonEpisodePersistenceMapper } from './season-episode-persistence.mapper';

const createSeason = (overrides = {}) => ({
  tmdbId: 101,
  number: 1,
  name: 'Season 1',
  overview: 'The first season of the show',
  posterPath: '/season1.jpg',
  airDate: new Date('2023-01-15'),
  episodeCount: 10,
  ...overrides,
});

const createEpisode = (overrides = {}) => ({
  tmdbId: 1001,
  number: 1,
  title: 'Pilot',
  overview: 'The pilot episode',
  airDate: new Date('2023-01-15'),
  runtime: 45,
  stillPath: '/still1.jpg',
  rating: 8.5,
  ...overrides,
});

describe('SeasonEpisodePersistenceMapper', () => {
  describe('toSeasonInsert', () => {
    it('should map all fields correctly', () => {
      const season = createSeason();

      const result = SeasonEpisodePersistenceMapper.toSeasonInsert('show-123', season as any);

      expect(result).toMatchObject({
        showId: 'show-123',
        tmdbId: 101,
        number: 1,
        name: 'Season 1',
        overview: 'The first season of the show',
        posterPath: '/season1.jpg',
        airDate: new Date('2023-01-15'),
        episodeCount: 10,
      });
    });

    it('should handle null values', () => {
      const season = createSeason({
        overview: null,
        posterPath: null,
        airDate: null,
      });

      const result = SeasonEpisodePersistenceMapper.toSeasonInsert('show-123', season as any);

      expect(result.overview).toBeNull();
      expect(result.posterPath).toBeNull();
      expect(result.airDate).toBeNull();
    });

    it('should handle season 0 (specials)', () => {
      const season = createSeason({
        number: 0,
        name: 'Specials',
      });

      const result = SeasonEpisodePersistenceMapper.toSeasonInsert('show-123', season as any);

      expect(result.number).toBe(0);
      expect(result.name).toBe('Specials');
    });

    it('should handle season with no episodes yet', () => {
      const season = createSeason({
        episodeCount: 0,
        airDate: null,
      });

      const result = SeasonEpisodePersistenceMapper.toSeasonInsert('show-123', season as any);

      expect(result.episodeCount).toBe(0);
      expect(result.airDate).toBeNull();
    });
  });

  describe('toSeasonUpdate', () => {
    it('should map defined fields only', () => {
      const season = createSeason();

      const result = SeasonEpisodePersistenceMapper.toSeasonUpdate(season as any);

      expect(result).toMatchObject({
        tmdbId: 101,
        name: 'Season 1',
        overview: 'The first season of the show',
        posterPath: '/season1.jpg',
        episodeCount: 10,
      });
    });

    it('should filter out undefined values', () => {
      const season = createSeason({
        name: 'Updated Season Name',
        overview: undefined,
        posterPath: undefined,
      });

      const result = SeasonEpisodePersistenceMapper.toSeasonUpdate(season as any);

      expect(result.name).toBe('Updated Season Name');
      expect(result).not.toHaveProperty('overview');
      expect(result).not.toHaveProperty('posterPath');
    });

    it('should keep null values (explicit clear)', () => {
      const season = createSeason({
        overview: null,
        posterPath: null,
      });

      const result = SeasonEpisodePersistenceMapper.toSeasonUpdate(season as any);

      expect(result.overview).toBeNull();
      expect(result.posterPath).toBeNull();
    });

    it('should return fallback field when all values undefined', () => {
      const season = {
        tmdbId: undefined,
        name: undefined,
        overview: undefined,
        posterPath: undefined,
        airDate: undefined,
        episodeCount: undefined,
      };

      const result = SeasonEpisodePersistenceMapper.toSeasonUpdate(season as any);

      // Returns { episodeCount: null } as fallback to prevent empty update
      expect(result).toEqual({ episodeCount: null });
    });

    it('should handle episode count update only', () => {
      const season = {
        episodeCount: 12,
        name: undefined,
      };

      const result = SeasonEpisodePersistenceMapper.toSeasonUpdate(season as any);

      expect(result).toEqual({ episodeCount: 12 });
    });
  });

  describe('toEpisodeInsert', () => {
    it('should map all fields correctly', () => {
      const episode = createEpisode();

      const result = SeasonEpisodePersistenceMapper.toEpisodeInsert(
        'season-1',
        'show-123',
        episode as any,
      );

      expect(result).toMatchObject({
        seasonId: 'season-1',
        showId: 'show-123',
        tmdbId: 1001,
        number: 1,
        title: 'Pilot',
        overview: 'The pilot episode',
        airDate: new Date('2023-01-15'),
        runtime: 45,
        stillPath: '/still1.jpg',
        voteAverage: 8.5,
      });
    });

    it('should map rating to voteAverage', () => {
      const episode = createEpisode({ rating: 9.2 });

      const result = SeasonEpisodePersistenceMapper.toEpisodeInsert(
        'season-1',
        'show-123',
        episode as any,
      );

      expect(result.voteAverage).toBe(9.2);
    });

    it('should handle null values', () => {
      const episode = createEpisode({
        overview: null,
        runtime: null,
        stillPath: null,
        rating: null,
      });

      const result = SeasonEpisodePersistenceMapper.toEpisodeInsert(
        'season-1',
        'show-123',
        episode as any,
      );

      expect(result.overview).toBeNull();
      expect(result.runtime).toBeNull();
      expect(result.stillPath).toBeNull();
      expect(result.voteAverage).toBeNull();
    });

    it('should handle episode with no air date (unaired)', () => {
      const episode = createEpisode({
        airDate: null,
        runtime: null,
        stillPath: null,
      });

      const result = SeasonEpisodePersistenceMapper.toEpisodeInsert(
        'season-1',
        'show-123',
        episode as any,
      );

      expect(result.airDate).toBeNull();
    });

    it('should handle episode number 0 (special)', () => {
      const episode = createEpisode({
        number: 0,
        title: 'Special Episode',
      });

      const result = SeasonEpisodePersistenceMapper.toEpisodeInsert(
        'season-1',
        'show-123',
        episode as any,
      );

      expect(result.number).toBe(0);
    });
  });

  describe('toEpisodeUpdate', () => {
    it('should map defined fields only', () => {
      const episode = createEpisode();

      const result = SeasonEpisodePersistenceMapper.toEpisodeUpdate(episode as any);

      expect(result).toMatchObject({
        tmdbId: 1001,
        title: 'Pilot',
        overview: 'The pilot episode',
        runtime: 45,
        stillPath: '/still1.jpg',
        voteAverage: 8.5,
      });
    });

    it('should filter out undefined values', () => {
      const episode = createEpisode({
        title: 'Updated Title',
        overview: undefined,
        runtime: undefined,
      });

      const result = SeasonEpisodePersistenceMapper.toEpisodeUpdate(episode as any);

      expect(result.title).toBe('Updated Title');
      expect(result).not.toHaveProperty('overview');
      expect(result).not.toHaveProperty('runtime');
    });

    it('should keep null values (explicit clear)', () => {
      const episode = createEpisode({
        overview: null,
        stillPath: null,
      });

      const result = SeasonEpisodePersistenceMapper.toEpisodeUpdate(episode as any);

      expect(result.overview).toBeNull();
      expect(result.stillPath).toBeNull();
    });

    it('should return fallback field when all values undefined', () => {
      const episode = {
        tmdbId: undefined,
        title: undefined,
        overview: undefined,
        airDate: undefined,
        runtime: undefined,
        stillPath: undefined,
        rating: undefined,
      };

      const result = SeasonEpisodePersistenceMapper.toEpisodeUpdate(episode as any);

      // Returns { runtime: null } as fallback to prevent empty update
      expect(result).toEqual({ runtime: null });
    });

    it('should handle title update only', () => {
      const episode = {
        title: 'New Episode Title',
        overview: undefined,
      };

      const result = SeasonEpisodePersistenceMapper.toEpisodeUpdate(episode as any);

      expect(result).toEqual({ title: 'New Episode Title' });
    });

    it('should handle runtime and rating update', () => {
      const episode = {
        runtime: 60,
        rating: 9.0,
        title: undefined,
      };

      const result = SeasonEpisodePersistenceMapper.toEpisodeUpdate(episode as any);

      expect(result).toEqual({ runtime: 60, voteAverage: 9.0 });
    });

    it('should update air date when episode finally airs', () => {
      const newAirDate = new Date('2024-03-15');

      const episode = {
        airDate: newAirDate,
        runtime: 50,
        rating: 8.7,
      };

      const result = SeasonEpisodePersistenceMapper.toEpisodeUpdate(episode as any);

      expect(result.airDate).toEqual(newAirDate);
      expect(result.runtime).toBe(50);
      expect(result.voteAverage).toBe(8.7);
    });
  });
});
