import { ShowPersistenceMapper } from './show-persistence.mapper';

const createShowDetails = (overrides = {}) => ({
  totalSeasons: 5,
  totalEpisodes: 73,
  lastAirDate: new Date('2024-01-15'),
  nextAirDate: new Date('2024-02-01'),
  status: 'Returning Series',
  ...overrides,
});

describe('ShowPersistenceMapper', () => {
  describe('toShowInsert', () => {
    it('should map all fields correctly', () => {
      const details = createShowDetails();

      const result = ShowPersistenceMapper.toShowInsert('media-456', details as any);

      expect(result).toMatchObject({
        mediaItemId: 'media-456',
        totalSeasons: 5,
        totalEpisodes: 73,
        lastAirDate: new Date('2024-01-15'),
        nextAirDate: new Date('2024-02-01'),
        status: 'Returning Series',
      });
    });

    it('should handle null values', () => {
      const details = createShowDetails({
        totalSeasons: null,
        totalEpisodes: null,
        lastAirDate: null,
        nextAirDate: null,
        status: null,
      });

      const result = ShowPersistenceMapper.toShowInsert('media-456', details as any);

      expect(result.totalSeasons).toBeNull();
      expect(result.totalEpisodes).toBeNull();
      expect(result.lastAirDate).toBeNull();
      expect(result.nextAirDate).toBeNull();
      expect(result.status).toBeNull();
    });

    it('should handle ended show (no nextAirDate)', () => {
      const details = createShowDetails({
        status: 'Ended',
        nextAirDate: null,
      });

      const result = ShowPersistenceMapper.toShowInsert('media-456', details as any);

      expect(result.status).toBe('Ended');
      expect(result.nextAirDate).toBeNull();
    });

    it('should handle show with 0 episodes (miniseries before air)', () => {
      const details = createShowDetails({
        totalSeasons: 1,
        totalEpisodes: 0,
      });

      const result = ShowPersistenceMapper.toShowInsert('media-456', details as any);

      expect(result.totalSeasons).toBe(1);
      expect(result.totalEpisodes).toBe(0);
    });
  });

  describe('toShowUpdate', () => {
    it('should map defined fields only', () => {
      const details = createShowDetails();

      const result = ShowPersistenceMapper.toShowUpdate(details as any);

      expect(result).toMatchObject({
        totalSeasons: 5,
        totalEpisodes: 73,
        status: 'Returning Series',
      });
    });

    it('should filter out undefined values', () => {
      const details = createShowDetails({
        totalSeasons: 6,
        totalEpisodes: undefined,
        lastAirDate: undefined,
      });

      const result = ShowPersistenceMapper.toShowUpdate(details as any);

      expect(result.totalSeasons).toBe(6);
      expect(result).not.toHaveProperty('totalEpisodes');
      expect(result).not.toHaveProperty('lastAirDate');
    });

    it('should keep null values (explicit clear)', () => {
      const details = createShowDetails({
        totalSeasons: 5,
        nextAirDate: null, // Show ended, clear next air date
      });

      const result = ShowPersistenceMapper.toShowUpdate(details as any);

      expect(result.totalSeasons).toBe(5);
      expect(result.nextAirDate).toBeNull();
    });

    it('should return fallback field when all values undefined', () => {
      const details = {
        totalSeasons: undefined,
        totalEpisodes: undefined,
        lastAirDate: undefined,
        nextAirDate: undefined,
        status: undefined,
      };

      const result = ShowPersistenceMapper.toShowUpdate(details as any);

      // Returns { totalSeasons: null } as fallback to prevent empty update
      expect(result).toEqual({ totalSeasons: null });
    });

    it('should handle partial update with only status change', () => {
      const details = {
        status: 'Canceled',
        totalSeasons: undefined,
        totalEpisodes: undefined,
      };

      const result = ShowPersistenceMapper.toShowUpdate(details as any);

      expect(result).toEqual({ status: 'Canceled' });
    });

    it('should handle season/episode count update', () => {
      const details = {
        totalSeasons: 6,
        totalEpisodes: 85,
        status: undefined,
      };

      const result = ShowPersistenceMapper.toShowUpdate(details as any);

      expect(result).toEqual({ totalSeasons: 6, totalEpisodes: 85 });
    });

    it('should handle update with new air dates', () => {
      const newLastAirDate = new Date('2024-03-01');
      const newNextAirDate = new Date('2024-03-08');

      const details = {
        lastAirDate: newLastAirDate,
        nextAirDate: newNextAirDate,
      };

      const result = ShowPersistenceMapper.toShowUpdate(details as any);

      expect(result.lastAirDate).toEqual(newLastAirDate);
      expect(result.nextAirDate).toEqual(newNextAirDate);
    });
  });
});
