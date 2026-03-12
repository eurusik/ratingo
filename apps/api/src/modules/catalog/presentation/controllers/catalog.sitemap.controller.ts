import { Controller, Get, UseFilters } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CatalogSitemapService } from '../../application/services/catalog-sitemap.service';
import { SitemapResponseDto } from '../dtos/sitemap-item.dto';
import { CatalogDomainExceptionFilter } from '../filters';

/**
 * Public sitemap endpoints for movies and shows.
 * No authentication required — consumed by the Next.js sitemap.ts generator.
 */
@ApiTags('Public: Catalog')
@UseFilters(CatalogDomainExceptionFilter)
@Controller('catalog/sitemap')
export class CatalogSitemapController {
  constructor(private readonly sitemapService: CatalogSitemapService) {}

  @Get('movies')
  @ApiOperation({
    summary: 'Movie sitemap data',
    description:
      'Returns slug and updatedAt for all active movies. Intended for sitemap generation.',
  })
  @ApiOkResponse({ type: SitemapResponseDto })
  async getMovieSitemap(): Promise<SitemapResponseDto> {
    const items = await this.sitemapService.getMovieSitemapItems();
    return { items };
  }

  @Get('shows')
  @ApiOperation({
    summary: 'Show sitemap data',
    description:
      'Returns slug and updatedAt for all active shows. Intended for sitemap generation.',
  })
  @ApiOkResponse({ type: SitemapResponseDto })
  async getShowSitemap(): Promise<SitemapResponseDto> {
    const items = await this.sitemapService.getShowSitemapItems();
    return { items };
  }
}
