import { Inject, Injectable, Logger } from '@nestjs/common';

import { isNull, asc } from 'drizzle-orm';
import { eq, and } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type SitemapItemDto } from '../../presentation/dtos/sitemap-item.dto';

/**
 * Provides lightweight slug + updatedAt lists for sitemap generation.
 * Returns all non-deleted, fully-ingested items of the requested type.
 */
@Injectable()
export class CatalogSitemapService {
  private readonly logger = new Logger(CatalogSitemapService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Returns slug and updatedAt for all active movies.
   */
  async getMovieSitemapItems(): Promise<SitemapItemDto[]> {
    return withDbError('fetch movie sitemap items', this.logger, async () => {
      const rows = await this.db
        .select({
          slug: schema.mediaItems.slug,
          updatedAt: schema.mediaItems.updatedAt,
        })
        .from(schema.mediaItems)
        .where(
          and(
            eq(schema.mediaItems.type, MediaType.MOVIE),
            eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
            isNull(schema.mediaItems.deletedAt),
          ),
        )
        .orderBy(asc(schema.mediaItems.slug));

      return rows.map((row) => ({
        slug: row.slug,
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  }

  /**
   * Returns slug and updatedAt for all active shows.
   */
  async getShowSitemapItems(): Promise<SitemapItemDto[]> {
    return withDbError('fetch show sitemap items', this.logger, async () => {
      const rows = await this.db
        .select({
          slug: schema.mediaItems.slug,
          updatedAt: schema.mediaItems.updatedAt,
        })
        .from(schema.mediaItems)
        .where(
          and(
            eq(schema.mediaItems.type, MediaType.SHOW),
            eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
            isNull(schema.mediaItems.deletedAt),
          ),
        )
        .orderBy(asc(schema.mediaItems.slug));

      return rows.map((row) => ({
        slug: row.slug,
        updatedAt: row.updatedAt.toISOString(),
      }));
    });
  }
}
