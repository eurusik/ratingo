import { Inject, Injectable } from '@nestjs/common';

import {
  type ISitemapRepository,
  SITEMAP_REPOSITORY,
  type SitemapItem,
} from '@/modules/catalog/domain/repositories/sitemap.repository.interface';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

/**
 * Provides lightweight slug + updatedAt lists for sitemap generation.
 * Returns non-deleted, fully-ingested shows and movies that are already out.
 */
@Injectable()
export class CatalogSitemapService {
  constructor(
    @Inject(SITEMAP_REPOSITORY)
    private readonly sitemapRepository: ISitemapRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  getMovieSitemapItems(): Promise<SitemapItem[]> {
    return this.sitemapRepository.findReleasedMovies(this.clock.now());
  }

  getShowSitemapItems(): Promise<SitemapItem[]> {
    return this.sitemapRepository.findReadyShows();
  }
}
