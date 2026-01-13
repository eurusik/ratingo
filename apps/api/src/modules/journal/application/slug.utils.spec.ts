import { ensureUniqueSlug, generateSlug } from './slug.utils';

describe('generateSlug', () => {
  describe('basic functionality', () => {
    it('should generate lowercase slug from English title', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(generateSlug('Hello! World?')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(generateSlug('Hello   World')).toBe('hello-world');
    });
  });

  describe('Ukrainian locale support', () => {
    it('should transliterate Ukrainian letters', () => {
      // slugify uses 'y' for 'и'
      expect(generateSlug('Привіт Світ')).toBe('pryvit-svit');
    });

    it('should handle Ukrainian letter "Ї"', () => {
      const slug = generateSlug('Їжак');
      expect(slug).toMatch(/^[a-z-]+$/); // valid slug format
      expect(slug.length).toBeGreaterThan(0);
    });

    it('should handle Ukrainian letter "Є"', () => {
      const slug = generateSlug('Європа');
      expect(slug).toMatch(/^[a-z-]+$/);
      expect(slug.length).toBeGreaterThan(0);
    });

    it('should handle Ukrainian letter "ґ"', () => {
      const slug = generateSlug('Ґанок');
      expect(slug).toMatch(/^[a-z-]+$/);
      expect(slug.length).toBeGreaterThan(0);
    });

    it('should handle apostrophe in Ukrainian text', () => {
      const slug = generateSlug("Що нового в Ratingo'24");
      // slugify uses 'h' for 'г'
      expect(slug).toBe('shcho-novoho-v-ratingo24');
    });

    it('should handle mixed Ukrainian and English', () => {
      // slugify uses 'yy' for 'ий'
      expect(generateSlug('Новий Update')).toBe('novyy-update');
    });
  });

  describe('edge cases', () => {
    it('should return nanoid-based slug for emoji-only titles', () => {
      const slug = generateSlug('🎉🚀');
      expect(slug).toMatch(/^post-[a-zA-Z0-9_-]{8}$/);
    });

    it('should return nanoid-based slug for empty string', () => {
      const slug = generateSlug('');
      expect(slug).toMatch(/^post-[a-zA-Z0-9_-]{8}$/);
    });

    it('should return nanoid-based slug for whitespace-only string', () => {
      const slug = generateSlug('   ');
      expect(slug).toMatch(/^post-[a-zA-Z0-9_-]{8}$/);
    });

    it('should handle very long titles', () => {
      const longTitle = 'A'.repeat(500);
      const slug = generateSlug(longTitle);
      expect(slug.length).toBeGreaterThan(0);
      expect(slug).toBe('a'.repeat(500));
    });

    it('should handle numbers', () => {
      expect(generateSlug('Version 2.0')).toBe('version-20');
    });

    it('should handle dashes in title', () => {
      expect(generateSlug('Hello - World')).toBe('hello-world');
    });
  });
});

describe('ensureUniqueSlug', () => {
  it('should return original slug if not exists', async () => {
    const existsBySlug = jest.fn().mockResolvedValue(false);
    const result = await ensureUniqueSlug('hello-world', existsBySlug);

    expect(result).toBe('hello-world');
    expect(existsBySlug).toHaveBeenCalledTimes(1);
    expect(existsBySlug).toHaveBeenCalledWith('hello-world');
  });

  it('should append counter if slug exists', async () => {
    const existsBySlug = jest
      .fn()
      .mockResolvedValueOnce(true) // hello-world exists
      .mockResolvedValueOnce(false); // hello-world-1 doesn't exist

    const result = await ensureUniqueSlug('hello-world', existsBySlug);

    expect(result).toBe('hello-world-1');
    expect(existsBySlug).toHaveBeenCalledTimes(2);
  });

  it('should increment counter until unique slug found', async () => {
    const existsBySlug = jest
      .fn()
      .mockResolvedValueOnce(true) // hello-world exists
      .mockResolvedValueOnce(true) // hello-world-1 exists
      .mockResolvedValueOnce(true) // hello-world-2 exists
      .mockResolvedValueOnce(false); // hello-world-3 doesn't exist

    const result = await ensureUniqueSlug('hello-world', existsBySlug);

    expect(result).toBe('hello-world-3');
    expect(existsBySlug).toHaveBeenCalledTimes(4);
  });
});
