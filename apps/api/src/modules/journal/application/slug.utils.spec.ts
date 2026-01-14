import { ensureUniqueSlug, generateSlug } from './slug.utils';

describe('generateSlug', () => {
  describe('basic functionality', () => {
    it('should generate lowercase slug from English title', async () => {
      expect(await generateSlug('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', async () => {
      expect(await generateSlug('Hello! World?')).toBe('hello-world');
    });

    it('should handle multiple spaces', async () => {
      expect(await generateSlug('Hello   World')).toBe('hello-world');
    });
  });

  describe('Ukrainian locale support', () => {
    it('should transliterate Ukrainian letters', async () => {
      // slugify uses 'y' for 'и'
      expect(await generateSlug('Привіт Світ')).toBe('pryvit-svit');
    });

    it('should handle Ukrainian letter "Ї"', async () => {
      const slug = await generateSlug('Їжак');
      expect(slug).toMatch(/^[a-z-]+$/); // valid slug format
      expect(slug.length).toBeGreaterThan(0);
    });

    it('should handle Ukrainian letter "Є"', async () => {
      const slug = await generateSlug('Європа');
      expect(slug).toMatch(/^[a-z-]+$/);
      expect(slug.length).toBeGreaterThan(0);
    });

    it('should handle Ukrainian letter "ґ"', async () => {
      const slug = await generateSlug('Ґанок');
      expect(slug).toMatch(/^[a-z-]+$/);
      expect(slug.length).toBeGreaterThan(0);
    });

    it('should handle apostrophe in Ukrainian text', async () => {
      const slug = await generateSlug("Що нового в Ratingo'24");
      // slugify uses 'h' for 'г'
      expect(slug).toBe('shcho-novoho-v-ratingo24');
    });

    it('should handle mixed Ukrainian and English', async () => {
      // slugify uses 'yy' for 'ий'
      expect(await generateSlug('Новий Update')).toBe('novyy-update');
    });
  });

  describe('edge cases', () => {
    it('should return nanoid-based slug for emoji-only titles', async () => {
      const slug = await generateSlug('🎉🚀');
      expect(slug).toMatch(/^post-[a-zA-Z0-9_-]{8}$/);
    });

    it('should return nanoid-based slug for empty string', async () => {
      const slug = await generateSlug('');
      expect(slug).toMatch(/^post-[a-zA-Z0-9_-]{8}$/);
    });

    it('should return nanoid-based slug for whitespace-only string', async () => {
      const slug = await generateSlug('   ');
      expect(slug).toMatch(/^post-[a-zA-Z0-9_-]{8}$/);
    });

    it('should handle very long titles', async () => {
      const longTitle = 'A'.repeat(500);
      const slug = await generateSlug(longTitle);
      expect(slug.length).toBeGreaterThan(0);
      expect(slug).toBe('a'.repeat(500));
    });

    it('should handle numbers', async () => {
      expect(await generateSlug('Version 2.0')).toBe('version-20');
    });

    it('should handle dashes in title', async () => {
      expect(await generateSlug('Hello - World')).toBe('hello-world');
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
