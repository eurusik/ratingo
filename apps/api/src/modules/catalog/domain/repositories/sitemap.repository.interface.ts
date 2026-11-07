import { type MediaType } from '@/common/enums/media-type.enum';

export interface SitemapItem {
  slug: string;
  updatedAt: Date;
}

export interface ISitemapRepository {
  findReadyItems(type: MediaType): Promise<SitemapItem[]>;
}

export const SITEMAP_REPOSITORY = Symbol('SITEMAP_REPOSITORY');
