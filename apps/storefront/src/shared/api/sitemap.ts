import type { components } from '@ratingo/api-contract';
import { apiGet } from '@ratingo/web-core/api';

export type SitemapItem = components['schemas']['SitemapItemDto'];
export type JournalPostListItem = components['schemas']['PostListItemDto'];
type SitemapResponse = components['schemas']['SitemapResponseDto'];
type PostListResponse = components['schemas']['PostListResponseDto'];
type SitemapMediaKind = 'movies' | 'shows';

const JOURNAL_PAGE_SIZE = 50;

async function getJournalPage(page: number): Promise<PostListResponse> {
  return apiGet<PostListResponse>('journal/posts', {
    searchParams: { page, limit: JOURNAL_PAGE_SIZE },
  });
}

export const sitemapApi = {
  async getMedia(kind: SitemapMediaKind): Promise<SitemapItem[]> {
    const response = await apiGet<SitemapResponse>(`catalog/sitemap/${kind}`);
    return response.items;
  },

  async getJournalPosts(): Promise<JournalPostListItem[]> {
    const firstPage = await getJournalPage(1);
    const totalPages = Math.ceil(firstPage.meta.total / JOURNAL_PAGE_SIZE);
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => getJournalPage(index + 2)),
    );
    return [firstPage, ...remainingPages].flatMap((page) => page.posts);
  },
};
