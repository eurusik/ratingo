import { resolveMediaImageUrl, IMAGE_SIZES, MEDIA_IMAGE_BASE } from '../image';

describe('resolveMediaImageUrl', () => {
  describe('without proxy (default)', () => {
    it('returns null for null/undefined path', () => {
      expect(resolveMediaImageUrl(null)).toBeNull();
      expect(resolveMediaImageUrl(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(resolveMediaImageUrl('')).toBeNull();
    });

    it('builds TMDB URL from relative path', () => {
      expect(resolveMediaImageUrl('/abc.jpg')).toBe(`${MEDIA_IMAGE_BASE}/w342/abc.jpg`);
    });

    it('uses specified size for TMDB path', () => {
      expect(resolveMediaImageUrl('/abc.jpg', IMAGE_SIZES.W185)).toBe(
        `${MEDIA_IMAGE_BASE}/w185/abc.jpg`,
      );
    });

    it('returns TVMaze full URL as-is when proxy not configured', () => {
      const tvmazeUrl = 'https://static.tvmaze.com/uploads/images/original_untouched/603/1509946.jpg';
      expect(resolveMediaImageUrl(tvmazeUrl)).toBe(tvmazeUrl);
    });

    it('returns Railway full URL as-is', () => {
      const railwayUrl = 'https://storage.railway.app/some/image.jpg';
      expect(resolveMediaImageUrl(railwayUrl)).toBe(railwayUrl);
    });

    it('returns any full http URL as-is', () => {
      const url = 'https://example.com/image.jpg';
      expect(resolveMediaImageUrl(url)).toBe(url);
    });
  });

  describe('MEDIA_IMAGE_BASE', () => {
    it('defaults to TMDB when no env var set', () => {
      expect(MEDIA_IMAGE_BASE).toBe('https://image.tmdb.org/t/p');
    });
  });
});
