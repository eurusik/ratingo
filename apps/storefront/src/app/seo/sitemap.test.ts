import { sitemapApi } from '@/shared/api';
import { SITE_URL } from '@/shared/config';
import { generateSitemap } from './sitemap';

jest.mock('@/shared/api', () => ({
  configureStorefrontApi: jest.fn(),
  sitemapApi: { getMedia: jest.fn(), getJournalPosts: jest.fn() },
}));

const getMedia = jest.mocked(sitemapApi.getMedia);
const getJournalPosts = jest.mocked(sitemapApi.getJournalPosts);

describe('generateSitemap', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the sitemap valid when one source fails', async () => {
    getMedia.mockImplementation(async (kind) => {
      if (kind === 'movies') throw new Error('API down');
      return [{ slug: 'outlander-2014', updatedAt: '2026-03-04T00:00:00.000Z' }];
    });
    getJournalPosts.mockResolvedValue([]);

    const urls = (await generateSitemap()).map((entry) => entry.url);

    expect(urls).toContain(`${SITE_URL}/shows/outlander-2014`);
    expect(urls.some((url) => url.includes('/movies/'))).toBe(false);
    expect(console.error).toHaveBeenCalledWith('Sitemap: failed to load movies', expect.any(Error));
  });
});
