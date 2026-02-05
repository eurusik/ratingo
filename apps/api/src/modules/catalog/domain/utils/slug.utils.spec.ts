import * as fc from 'fast-check';

import {
  generateSlug,
  generateUniqueSlug,
  hasTmdbIdSuffix,
  createFallbackSlug,
  createRetrySlug,
} from './slug.utils';

describe('slug.utils', () => {
  describe('generateSlug', () => {
    it('should generate slug from title', () => {
      expect(generateSlug('The Matrix', 603)).toBe('the-matrix');
    });

    it('should fallback to tmdb-{id} when title is null', () => {
      expect(generateSlug(null, 603)).toBe('tmdb-603');
    });

    it('should fallback to tmdb-{id} when title is empty', () => {
      expect(generateSlug('', 603)).toBe('tmdb-603');
    });

    it('should fallback to tmdb-{id} when slug is too short', () => {
      expect(generateSlug('ab', 603)).toBe('tmdb-603');
    });

    it('should fallback to tmdb-{id} when slug is digits-only', () => {
      expect(generateSlug('1984', 603)).toBe('tmdb-603');
    });
  });

  describe('hasTmdbIdSuffix', () => {
    it('should return true when slug ends with -tmdbId', () => {
      expect(hasTmdbIdSuffix('the-matrix-603', 603)).toBe(true);
    });

    it('should return false when slug does not end with -tmdbId', () => {
      expect(hasTmdbIdSuffix('the-matrix', 603)).toBe(false);
    });

    it('should return false when slug ends with different number', () => {
      expect(hasTmdbIdSuffix('the-matrix-604', 603)).toBe(false);
    });

    it('should return false when suffix is substring not at end', () => {
      expect(hasTmdbIdSuffix('the-603-matrix', 603)).toBe(false);
    });
  });

  describe('generateUniqueSlug', () => {
    it('should append tmdbId suffix to slug', () => {
      expect(generateUniqueSlug('the-matrix', 603)).toBe('the-matrix-603');
    });

    it('should not double-suffix when slug already ends with tmdbId', () => {
      expect(generateUniqueSlug('the-matrix-603', 603)).toBe('the-matrix-603');
    });

    it('should handle empty slug', () => {
      expect(generateUniqueSlug('', 12345)).toBe('-12345');
    });

    it('should handle slug ending with similar but different number', () => {
      expect(generateUniqueSlug('the-matrix-60', 603)).toBe('the-matrix-60-603');
    });

    describe('property-based tests', () => {
      it('should always produce slug ending with tmdbId suffix', () => {
        fc.assert(
          fc.property(fc.string(), fc.integer({ min: 1 }), (slug, tmdbId) => {
            const result = generateUniqueSlug(slug, tmdbId);
            return result.endsWith(`-${tmdbId}`);
          }),
        );
      });

      it('should be idempotent', () => {
        fc.assert(
          fc.property(fc.string(), fc.integer({ min: 1 }), (slug, tmdbId) => {
            const first = generateUniqueSlug(slug, tmdbId);
            const second = generateUniqueSlug(first, tmdbId);
            return first === second;
          }),
        );
      });
    });
  });

  describe('createFallbackSlug', () => {
    it('should create slug in tmdb-{id} format', () => {
      expect(createFallbackSlug(12345)).toBe('tmdb-12345');
    });
  });

  describe('createRetrySlug', () => {
    it('should use original slug with tmdbId suffix', () => {
      expect(createRetrySlug('the-matrix', 603)).toBe('the-matrix-603');
    });

    it('should use fallback when original is undefined', () => {
      expect(createRetrySlug(undefined, 12345)).toBe('tmdb-12345');
    });

    it('should use fallback when original is empty string', () => {
      expect(createRetrySlug('', 12345)).toBe('tmdb-12345');
    });

    it('should not double-suffix existing suffixed slug', () => {
      expect(createRetrySlug('the-matrix-603', 603)).toBe('the-matrix-603');
    });

    describe('property-based tests', () => {
      it('should always produce valid slug', () => {
        fc.assert(
          fc.property(
            fc.option(fc.string(), { nil: undefined }),
            fc.integer({ min: 1 }),
            (slug, tmdbId) => {
              const result = createRetrySlug(slug, tmdbId);
              return typeof result === 'string' && result.length > 0;
            },
          ),
        );
      });
    });
  });
});
