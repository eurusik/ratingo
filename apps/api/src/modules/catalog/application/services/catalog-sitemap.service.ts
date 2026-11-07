import { Inject, Injectable } from '@nestjs/common';

import { MediaType } from '@/common/enums/media-type.enum';
import {
  type ISitemapRepository,
  SITEMAP_REPOSITORY,
  type SitemapItem,
} from '@/modules/catalog/domain/repositories/sitemap.repository.interface';

/**
 * Provides lightweight slug + updatedAt lists for sitemap generation.
 * Returns all non-deleted, fully-ingested movies or shows.
 */
@Injectable()
export class CatalogSitemapService {
  constructor(
    @Inject(SITEMAP_REPOSITORY)
    private readonly sitemapRepository: ISitemapRepository,
  ) {}

  /**
   * Returns slug and updatedAt for all active movies.
   */
  getMovieSitemapItems(): Promise<SitemapItem[]> {
    return this.sitemapRepository.findReadyItems(MediaType.MOVIE);
  }

  /**
   * Returns slug and updatedAt for all active shows.
   */
  getShowSitemapItems(): Promise<SitemapItem[]> {
    return this.sitemapRepository.findReadyItems(MediaType.SHOW);
  }
}
