import { MoviePersistenceMapper } from './movie-persistence.mapper';

const createMovieDetails = (overrides = {}) => ({
  runtime: 120,
  budget: 150000000,
  revenue: 500000000,
  status: 'Released',
  theatricalReleaseDate: new Date('2024-03-15'),
  digitalReleaseDate: new Date('2024-06-01'),
  releases: [
    { country: 'US', date: '2024-03-15', type: 'theatrical' },
    { country: 'UK', date: '2024-03-22', type: 'theatrical' },
  ],
  ...overrides,
});

describe('MoviePersistenceMapper', () => {
  describe('toMovieInsert', () => {
    it('should map all fields correctly', () => {
      const details = createMovieDetails();

      const result = MoviePersistenceMapper.toMovieInsert('media-123', details as any);

      expect(result).toMatchObject({
        mediaItemId: 'media-123',
        runtime: 120,
        budget: 150000000,
        revenue: 500000000,
        status: 'Released',
        theatricalReleaseDate: new Date('2024-03-15'),
        digitalReleaseDate: new Date('2024-06-01'),
      });
      expect(result.releases).toHaveLength(2);
    });

    it('should handle null values', () => {
      const details = createMovieDetails({
        runtime: null,
        budget: null,
        revenue: null,
        theatricalReleaseDate: null,
        digitalReleaseDate: null,
      });

      const result = MoviePersistenceMapper.toMovieInsert('media-123', details as any);

      expect(result.runtime).toBeNull();
      expect(result.budget).toBeNull();
      expect(result.revenue).toBeNull();
      expect(result.theatricalReleaseDate).toBeNull();
      expect(result.digitalReleaseDate).toBeNull();
    });

    it('should handle undefined values', () => {
      const details = createMovieDetails({
        runtime: undefined,
        budget: undefined,
      });

      const result = MoviePersistenceMapper.toMovieInsert('media-123', details as any);

      expect(result.runtime).toBeUndefined();
      expect(result.budget).toBeUndefined();
    });

    it('should handle empty releases array', () => {
      const details = createMovieDetails({ releases: [] });

      const result = MoviePersistenceMapper.toMovieInsert('media-123', details as any);

      expect(result.releases).toEqual([]);
    });

    it('should handle missing releases', () => {
      const details = createMovieDetails({ releases: undefined });

      const result = MoviePersistenceMapper.toMovieInsert('media-123', details as any);

      expect(result.releases).toBeUndefined();
    });
  });

  describe('toMovieUpdate', () => {
    it('should map defined fields only', () => {
      const details = createMovieDetails();

      const result = MoviePersistenceMapper.toMovieUpdate(details as any);

      expect(result).toMatchObject({
        runtime: 120,
        budget: 150000000,
        revenue: 500000000,
        status: 'Released',
      });
    });

    it('should filter out undefined values', () => {
      const details = createMovieDetails({
        runtime: 90,
        budget: undefined,
        revenue: undefined,
      });

      const result = MoviePersistenceMapper.toMovieUpdate(details as any);

      expect(result.runtime).toBe(90);
      expect(result).not.toHaveProperty('budget');
      expect(result).not.toHaveProperty('revenue');
    });

    it('should keep null values (explicit clear)', () => {
      const details = createMovieDetails({
        runtime: 90,
        budget: null,
      });

      const result = MoviePersistenceMapper.toMovieUpdate(details as any);

      expect(result.runtime).toBe(90);
      expect(result.budget).toBeNull();
    });

    it('should return fallback field when all values undefined', () => {
      const details = {
        runtime: undefined,
        budget: undefined,
        revenue: undefined,
        status: undefined,
        theatricalReleaseDate: undefined,
        digitalReleaseDate: undefined,
        releases: undefined,
      };

      const result = MoviePersistenceMapper.toMovieUpdate(details as any);

      // Returns { runtime: null } as fallback to prevent empty update
      expect(result).toEqual({ runtime: null });
    });

    it('should handle partial update with only status', () => {
      const details = {
        status: 'Post Production',
        runtime: undefined,
        budget: undefined,
      };

      const result = MoviePersistenceMapper.toMovieUpdate(details as any);

      expect(result).toEqual({ status: 'Post Production' });
    });

    it('should include releases in update', () => {
      const details = createMovieDetails({
        releases: [{ country: 'JP', date: '2024-04-01', type: 'theatrical' }],
      });

      const result = MoviePersistenceMapper.toMovieUpdate(details as any);

      expect(result.releases).toHaveLength(1);
      expect(result.releases![0].country).toBe('JP');
    });
  });
});
