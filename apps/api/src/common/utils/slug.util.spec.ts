import { generateSlug } from './slug.util';

describe('slug.util', () => {
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
});
