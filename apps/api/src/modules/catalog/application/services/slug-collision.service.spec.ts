import * as fc from 'fast-check';

import { SlugCollisionService } from './slug-collision.service';

describe('SlugCollisionService', () => {
  let service: SlugCollisionService;

  beforeEach(() => {
    service = new SlugCollisionService();
  });

  describe('generateUniqueSlug', () => {
    it('should append tmdbId suffix to slug', () => {
      expect(service.generateUniqueSlug('the-matrix', 603)).toBe('the-matrix-603');
    });

    it('should not double-suffix when slug already ends with tmdbId', () => {
      expect(service.generateUniqueSlug('the-matrix-603', 603)).toBe('the-matrix-603');
    });

    it('should handle empty slug', () => {
      expect(service.generateUniqueSlug('', 12345)).toBe('-12345');
    });

    it('should handle slug ending with similar but different number', () => {
      expect(service.generateUniqueSlug('the-matrix-60', 603)).toBe('the-matrix-60-603');
    });

    describe('property-based tests', () => {
      it('should always produce slug ending with tmdbId suffix', () => {
        fc.assert(
          fc.property(fc.string(), fc.integer({ min: 1 }), (slug, tmdbId) => {
            const result = service.generateUniqueSlug(slug, tmdbId);
            return result.endsWith(`-${tmdbId}`);
          }),
        );
      });

      it('should be idempotent', () => {
        fc.assert(
          fc.property(fc.string(), fc.integer({ min: 1 }), (slug, tmdbId) => {
            const first = service.generateUniqueSlug(slug, tmdbId);
            const second = service.generateUniqueSlug(first, tmdbId);
            return first === second;
          }),
        );
      });
    });
  });

  describe('hasTmdbIdSuffix', () => {
    it('should return true when slug ends with -tmdbId', () => {
      expect(service.hasTmdbIdSuffix('the-matrix-603', 603)).toBe(true);
    });

    it('should return false when slug does not end with -tmdbId', () => {
      expect(service.hasTmdbIdSuffix('the-matrix', 603)).toBe(false);
    });

    it('should return false when slug ends with different number', () => {
      expect(service.hasTmdbIdSuffix('the-matrix-604', 603)).toBe(false);
    });

    it('should return false when suffix is substring not at end', () => {
      expect(service.hasTmdbIdSuffix('the-603-matrix', 603)).toBe(false);
    });
  });

  describe('createFallbackSlug', () => {
    it('should create slug in tmdb-{id} format', () => {
      expect(service.createFallbackSlug(12345)).toBe('tmdb-12345');
    });
  });

  describe('createRetrySlug', () => {
    it('should use original slug with tmdbId suffix', () => {
      expect(service.createRetrySlug('the-matrix', 603)).toBe('the-matrix-603');
    });

    it('should use fallback when original is undefined', () => {
      expect(service.createRetrySlug(undefined, 12345)).toBe('tmdb-12345');
    });

    it('should use fallback when original is empty string', () => {
      // Empty string is falsy, so fallback is used
      expect(service.createRetrySlug('', 12345)).toBe('tmdb-12345');
    });

    it('should not double-suffix existing suffixed slug', () => {
      expect(service.createRetrySlug('the-matrix-603', 603)).toBe('the-matrix-603');
    });

    describe('property-based tests', () => {
      it('should always produce valid slug', () => {
        fc.assert(
          fc.property(
            fc.option(fc.string(), { nil: undefined }),
            fc.integer({ min: 1 }),
            (slug, tmdbId) => {
              const result = service.createRetrySlug(slug, tmdbId);
              return typeof result === 'string' && result.length > 0;
            },
          ),
        );
      });
    });
  });
});
