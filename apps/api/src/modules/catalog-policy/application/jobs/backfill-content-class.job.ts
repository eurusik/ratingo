/**
 * Backfill Content Class Job
 *
 * Classifies existing media_items based on genres and origin metadata.
 * Processes in batches for performance and uses cursor-based pagination.
 */

import { Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import * as schema from '../../../../database/schema';
import {
  classifyContent,
  ContentClass,
  ContentClassValues,
} from '../../domain/classification.service';

export interface BackfillProgress {
  processed: number;
  updated: number;
  byClass: Record<ContentClass, number>;
  errors: number;
}

export interface BackfillOptions {
  batchSize?: number;
  dryRun?: boolean;
}

interface MediaItemRow {
  id: string;
  contentClass: string;
  originCountries: string[] | null;
  originalLanguage: string | null;
  genreIds: number[];
}

/**
 * Backfills content_class for all existing media_items.
 *
 * @param db - Database connection
 * @param logger - Logger instance
 * @param options - Backfill options
 * @returns Progress statistics
 */
export async function backfillContentClass(
  db: PostgresJsDatabase<typeof schema>,
  logger: Logger,
  options: BackfillOptions = {},
): Promise<BackfillProgress> {
  const { batchSize = 1000, dryRun = false } = options;

  const progress: BackfillProgress = {
    processed: 0,
    updated: 0,
    byClass: {
      [ContentClassValues.MAINSTREAM]: 0,
      [ContentClassValues.ANIME]: 0,
      [ContentClassValues.DOCUMENTARY]: 0,
      [ContentClassValues.REALITY]: 0,
      [ContentClassValues.KIDS]: 0,
    },
    errors: 0,
  };

  let cursor: string | null = null;

  logger.log(`Starting content_class backfill (batchSize=${batchSize}, dryRun=${dryRun})`);

  while (true) {
    const batch = await fetchBatchWithGenres(db, batchSize, cursor);

    if (batch.length === 0) {
      break;
    }

    const updates: Array<{ id: string; contentClass: ContentClass }> = [];

    for (const item of batch) {
      try {
        const newClass = classifyContent({
          originCountries: item.originCountries,
          originalLanguage: item.originalLanguage,
          genreIds: item.genreIds,
        });

        progress.processed++;
        progress.byClass[newClass]++;

        if (newClass !== item.contentClass) {
          updates.push({ id: item.id, contentClass: newClass });

          if (newClass !== ContentClassValues.MAINSTREAM) {
            logger.debug(`Reclassifying ${item.id}: ${item.contentClass} → ${newClass}`);
          }
        }
      } catch (error) {
        progress.errors++;
        logger.error(`Failed to classify ${item.id}`, error);
      }
    }

    if (updates.length > 0 && !dryRun) {
      await batchUpdate(db, updates);
      progress.updated += updates.length;
    }

    cursor = batch[batch.length - 1].id;

    logger.log(`Backfill progress: ${progress.processed} processed, ${progress.updated} updated`, {
      byClass: progress.byClass,
      errors: progress.errors,
    });
  }

  logger.log(`Backfill complete`, {
    processed: progress.processed,
    updated: progress.updated,
    byClass: progress.byClass,
    errors: progress.errors,
    dryRun,
  });

  return progress;
}

/**
 * Fetches batch of media items with their genre IDs.
 *
 * @param db - Database connection
 * @param batchSize - Max items to fetch
 * @param cursor - Last item ID for pagination
 * @returns Array of media items with genre IDs
 */
async function fetchBatchWithGenres(
  db: PostgresJsDatabase<typeof schema>,
  batchSize: number,
  cursor: string | null,
): Promise<MediaItemRow[]> {
  const cursorCondition = cursor ? sql`mi.id > ${cursor}` : sql`1=1`;

  const result = await db.execute<{
    id: string;
    content_class: string;
    origin_countries: string[] | null;
    original_language: string | null;
    genre_ids: number[] | null;
  }>(sql`
    SELECT 
      mi.id,
      mi.content_class,
      mi.origin_countries,
      mi.original_language,
      COALESCE(
        array_agg(g.tmdb_id) FILTER (WHERE g.tmdb_id IS NOT NULL),
        '{}'::integer[]
      ) as genre_ids
    FROM ${schema.mediaItems} mi
    LEFT JOIN ${schema.mediaGenres} mg ON mg.media_item_id = mi.id
    LEFT JOIN ${schema.genres} g ON g.id = mg.genre_id
    WHERE ${cursorCondition}
      AND mi.deleted_at IS NULL
    GROUP BY mi.id
    ORDER BY mi.id
    LIMIT ${batchSize}
  `);

  return result.map((row) => ({
    id: row.id,
    contentClass: row.content_class,
    originCountries: row.origin_countries,
    originalLanguage: row.original_language,
    genreIds: row.genre_ids ?? [],
  }));
}

/**
 * Batch updates content_class using CASE WHEN for efficiency.
 *
 * @param db - Database connection
 * @param updates - Array of updates to apply
 */
async function batchUpdate(
  db: PostgresJsDatabase<typeof schema>,
  updates: Array<{ id: string; contentClass: ContentClass }>,
): Promise<void> {
  if (updates.length === 0) return;

  const caseWhen = updates
    .map((u) => sql`WHEN id = ${u.id} THEN ${u.contentClass}::content_class`)
    .reduce((acc, curr) => sql`${acc} ${curr}`);

  const ids = updates.map((u) => u.id);

  await db.execute(sql`
    UPDATE ${schema.mediaItems}
    SET 
      content_class = CASE ${caseWhen} END,
      updated_at = NOW()
    WHERE id = ANY(${sql.raw(`ARRAY['${ids.join("','")}']::uuid[]`)})
  `);
}
