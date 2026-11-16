import type { components } from '@ratingo/api-contract';
import { apiGet } from '@ratingo/web-core/api';

export type SitemapItem = components['schemas']['SitemapItemDto'];
type SitemapResponse = components['schemas']['SitemapResponseDto'];
type SitemapMediaKind = 'movies' | 'shows';

export const sitemapApi = {
  async getMedia(kind: SitemapMediaKind): Promise<SitemapItem[]> {
    const response = await apiGet<SitemapResponse>(`catalog/sitemap/${kind}`);
    return response.items;
  },
};
