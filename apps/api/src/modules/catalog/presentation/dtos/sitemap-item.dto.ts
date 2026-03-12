import { ApiProperty } from '@nestjs/swagger';

/**
 * A single item in the sitemap response, containing slug and last-modified timestamp.
 */
export class SitemapItemDto {
  @ApiProperty({ description: 'URL-friendly identifier for the media item' })
  slug: string;

  @ApiProperty({ description: 'ISO 8601 timestamp of when the item was last updated' })
  updatedAt: string;
}

/**
 * Sitemap response wrapping a flat list of slugs and their last-modified timestamps.
 */
export class SitemapResponseDto {
  @ApiProperty({ type: [SitemapItemDto] })
  items: SitemapItemDto[];
}
