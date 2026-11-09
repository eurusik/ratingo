import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, exists, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { errorMessage } from '@/common/utils/error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { type LocalSearchResult } from '@/modules/catalog/domain/models/search-result.model';
import { EligibilityStatus, EvaluationContext } from '@/modules/catalog-policy/public';

import { escapeLikePattern } from '../utils/like-escape.utils';

@Injectable()
export class MediaSearchQuery {
  private readonly logger = new Logger(MediaSearchQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Searches for media items using trigram similarity (pg_trgm).
   * Supports fuzzy matching and works well with any language including Ukrainian.
   * Only returns ELIGIBLE items (filtered via media_catalog_evaluations).
   *
   * Note: Returns empty array on error (graceful degradation for user-facing search).
   */
  async execute(query: string, limit: number): Promise<LocalSearchResult[]> {
    try {
      const searchTerm = query.trim();
      // Escape %, _ and \ so user input is matched literally inside ILIKE
      const likePattern = `%${escapeLikePattern(searchTerm)}%`;

      return await this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          alternativeTitles: schema.mediaItems.alternativeTitles,
          slug: schema.mediaItems.slug,
          posterPath: schema.mediaItems.posterPath,
          rating: schema.mediaItems.rating,
          releaseDate: schema.mediaItems.releaseDate,
          ingestionStatus: schema.mediaItems.ingestionStatus,
        })
        .from(schema.mediaItems)
        .where(
          and(
            sql`${schema.mediaItems.deletedAt} IS NULL`,
            // Eligibility filter: EXISTS avoids row multiplication from multiple policy versions
            exists(
              this.db
                .select({ one: sql`1` })
                .from(schema.mediaCatalogEvaluations)
                .where(
                  and(
                    eq(schema.mediaCatalogEvaluations.mediaItemId, schema.mediaItems.id),
                    eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
                    eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
                  ),
                ),
            ),
            // Ready filter: only show items with ready ingestion status
            eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
            sql`(
              ${schema.mediaItems.title} ILIKE ${likePattern}
              OR ${schema.mediaItems.originalTitle} ILIKE ${likePattern}
              OR ${schema.mediaItems.title} % ${searchTerm}
              OR ${schema.mediaItems.originalTitle} % ${searchTerm}
              OR EXISTS (
                SELECT 1 FROM unnest(${schema.mediaItems.alternativeTitles}) AS alt
                WHERE alt ILIKE ${likePattern} OR alt % ${searchTerm}
              )
            )`,
          ),
        )
        .orderBy(
          // Order by similarity score (higher = better match)
          sql`GREATEST(
            similarity(${schema.mediaItems.title}, ${searchTerm}),
            similarity(COALESCE(${schema.mediaItems.originalTitle}, ''), ${searchTerm}),
            COALESCE((SELECT MAX(similarity(alt, ${searchTerm})) FROM unnest(${schema.mediaItems.alternativeTitles}) AS alt), 0)
          ) DESC`,
          desc(schema.mediaItems.popularity),
        )
        .limit(limit);
    } catch (error: unknown) {
      const message = errorMessage(error);
      this.logger.error(`Failed to search media for "${query}": ${message}`);
      return [];
    }
  }
}
