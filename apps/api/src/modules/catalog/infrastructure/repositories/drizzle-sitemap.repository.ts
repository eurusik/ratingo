import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { type MediaType } from '@/common/enums/media-type.enum';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import {
  type ISitemapRepository,
  type SitemapItem,
} from '@/modules/catalog/domain/repositories/sitemap.repository.interface';

@Injectable()
export class DrizzleSitemapRepository implements ISitemapRepository {
  private readonly logger = new Logger(DrizzleSitemapRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findReadyItems(type: MediaType): Promise<SitemapItem[]> {
    return withDbError(`fetch ${type} sitemap items`, this.logger, () =>
      this.db
        .select({
          slug: schema.mediaItems.slug,
          updatedAt: schema.mediaItems.updatedAt,
        })
        .from(schema.mediaItems)
        .where(
          and(
            eq(schema.mediaItems.type, type),
            eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
            isNull(schema.mediaItems.deletedAt),
          ),
        )
        .orderBy(asc(schema.mediaItems.slug)),
    );
  }
}
