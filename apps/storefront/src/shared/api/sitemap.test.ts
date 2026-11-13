import { apiGet } from '@ratingo/web-core/api';
import { sitemapApi } from './sitemap';

jest.mock('@ratingo/web-core/api', () => ({ apiGet: jest.fn() }));

const mockedApiGet = jest.mocked(apiGet);

function journalPage(page: number, total: number) {
  return { posts: [{ slug: `post-${page}` }], meta: { total, page } };
}

describe('sitemapApi.getJournalPosts', () => {
  afterEach(() => mockedApiGet.mockReset());

  it('reads every page of posts', async () => {
    mockedApiGet.mockImplementation(async (_path, options) => {
      const { page } = options?.searchParams as { page: number };
      return journalPage(page, 120);
    });

    const posts = await sitemapApi.getJournalPosts();

    expect(posts.map((post) => post.slug)).toEqual(['post-1', 'post-2', 'post-3']);
    expect(mockedApiGet).toHaveBeenCalledTimes(3);
  });

  it('stops after the first page when the journal is empty', async () => {
    mockedApiGet.mockResolvedValue({ posts: [], meta: { total: 0, page: 1 } });

    expect(await sitemapApi.getJournalPosts()).toEqual([]);
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
  });
});
