/**
 * Unmapped Tracking Repository Implementation
 *
 * Drizzle-based repository for tracking unmapped TMDB provider IDs.
 * Uses atomic upserts to handle concurrent writes safely.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { desc, eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { providerUnmapped } from '../../../../database/schema';
import type {
  FindAllUnmappedOptions,
  FindAllUnmappedResult,
  IUnmappedTrackingRepository,
  RecordUnmappedInput,
} from '../../domain/repositories/unmapped-tracking.repository.interface';
import type { UnmappedProvider } from '../../domain/types/provider.types';

/** Maximum unique sample names to store per provider */
const MAX_SAMPLE_NAMES = 5;

/** Maximum unique sample regions to store per provider */
const MAX_SAMPLE_REGIONS = 10;

@Injectable()
export class UnmappedTrackingRepository implements IUnmappedTrackingRepository {
  private readonly logger = new Logger(UnmappedTrackingRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async recordUnmapped(input: RecordUnmappedInput): Promise<void> {
    const { tmdbProviderId, providerName, region } = input;

    try {
      await this.db
        .insert(providerUnmapped)
        .values({
          tmdbProviderId,
          lastSeenName: providerName,
          sampleNames: [providerName],
          sampleRegions: [region],
          seenCount: 1,
        })
        .onConflictDoUpdate({
          target: providerUnmapped.tmdbProviderId,
          set: {
            lastSeenName: providerName,
            lastSeenAt: sql`now()`,
            // Atomic increment in SQL
            seenCount: sql`${providerUnmapped.seenCount} + 1`,
            // Merge arrays: new first, dedupe by first occurrence, limit, preserve order
            sampleNames: sql`(
              WITH src AS (
                SELECT elem, ord
                FROM unnest(
                  ARRAY[${providerName}]::text[] || COALESCE(${providerUnmapped.sampleNames}, ARRAY[]::text[])
                ) WITH ORDINALITY AS t(elem, ord)
              ),
              dedup AS (
                SELECT elem, MIN(ord) AS ord
                FROM src
                GROUP BY elem
              )
              SELECT COALESCE(array_agg(elem ORDER BY ord), ARRAY[]::text[])
              FROM (SELECT elem, ord FROM dedup ORDER BY ord LIMIT ${MAX_SAMPLE_NAMES}) x
            )`,
            sampleRegions: sql`(
              WITH src AS (
                SELECT elem, ord
                FROM unnest(
                  ARRAY[${region}]::text[] || COALESCE(${providerUnmapped.sampleRegions}, ARRAY[]::text[])
                ) WITH ORDINALITY AS t(elem, ord)
              ),
              dedup AS (
                SELECT elem, MIN(ord) AS ord
                FROM src
                GROUP BY elem
              )
              SELECT COALESCE(array_agg(elem ORDER BY ord), ARRAY[]::text[])
              FROM (SELECT elem, ord FROM dedup ORDER BY ord LIMIT ${MAX_SAMPLE_REGIONS}) x
            )`,
          },
        });
    } catch (error) {
      this.logger.error(`Failed to record unmapped provider ${tmdbProviderId}`, error);
      throw error;
    }
  }

  async recordUnmappedBatch(inputs: RecordUnmappedInput[]): Promise<void> {
    if (inputs.length === 0) return;

    // Aggregate inputs by tmdbProviderId in JS first
    const aggregated = this.aggregateInputs(inputs);

    // Bulk upsert all aggregated entries
    try {
      for (const entry of aggregated.values()) {
        await this.upsertAggregatedEntry(entry);
      }
    } catch (error) {
      this.logger.error('Failed to record unmapped batch', error);
      throw error;
    }
  }

  async findAll(options?: FindAllUnmappedOptions): Promise<FindAllUnmappedResult> {
    const { sortBy = 'seenCount', sortOrder = 'desc', limit = 50, offset = 0 } = options ?? {};

    try {
      // Get total count
      const countResult = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(providerUnmapped);
      const total = countResult[0]?.count ?? 0;

      // Get paginated data
      let query = this.db.select().from(providerUnmapped);

      const orderColumn =
        sortBy === 'seenCount' ? providerUnmapped.seenCount : providerUnmapped.lastSeenAt;
      query =
        sortOrder === 'desc'
          ? (query.orderBy(desc(orderColumn)) as typeof query)
          : (query.orderBy(orderColumn) as typeof query);

      query = query.limit(limit).offset(offset) as typeof query;

      const rows = await query;

      return {
        data: rows.map(this.toDomain),
        total,
      };
    } catch (error) {
      this.logger.error('Failed to find all unmapped providers', error);
      throw error;
    }
  }

  async findByTmdbId(tmdbProviderId: number): Promise<UnmappedProvider | null> {
    try {
      const rows = await this.db
        .select()
        .from(providerUnmapped)
        .where(eq(providerUnmapped.tmdbProviderId, tmdbProviderId))
        .limit(1);

      return rows[0] ? this.toDomain(rows[0]) : null;
    } catch (error) {
      this.logger.error(`Failed to find unmapped provider ${tmdbProviderId}`, error);
      throw error;
    }
  }

  async removeByTmdbId(tmdbProviderId: number): Promise<void> {
    try {
      await this.db
        .delete(providerUnmapped)
        .where(eq(providerUnmapped.tmdbProviderId, tmdbProviderId));
    } catch (error) {
      this.logger.error(`Failed to remove unmapped provider ${tmdbProviderId}`, error);
      throw error;
    }
  }

  private aggregateInputs(inputs: RecordUnmappedInput[]): Map<number, AggregatedEntry> {
    const map = new Map<number, AggregatedEntry>();

    for (const input of inputs) {
      const existing = map.get(input.tmdbProviderId);
      if (existing) {
        existing.count++;
        existing.names.add(input.providerName);
        existing.regions.add(input.region);
        existing.lastSeenName = input.providerName;
      } else {
        map.set(input.tmdbProviderId, {
          tmdbProviderId: input.tmdbProviderId,
          lastSeenName: input.providerName,
          names: new Set([input.providerName]),
          regions: new Set([input.region]),
          count: 1,
        });
      }
    }

    return map;
  }

  /**
   * Atomic upsert for aggregated entry.
   * Uses ON CONFLICT DO UPDATE with SQL-based array merge and atomic increment.
   */
  private async upsertAggregatedEntry(entry: AggregatedEntry): Promise<void> {
    const { tmdbProviderId, lastSeenName, names, regions, count } = entry;
    const namesArray = [...names].slice(0, MAX_SAMPLE_NAMES);
    const regionsArray = [...regions].slice(0, MAX_SAMPLE_REGIONS);

    // Build SQL array literals for proper interpolation
    const namesSql =
      namesArray.length > 0
        ? sql`ARRAY[${sql.join(
            namesArray.map((n) => sql`${n}`),
            sql`, `,
          )}]::text[]`
        : sql`ARRAY[]::text[]`;

    const regionsSql =
      regionsArray.length > 0
        ? sql`ARRAY[${sql.join(
            regionsArray.map((r) => sql`${r}`),
            sql`, `,
          )}]::text[]`
        : sql`ARRAY[]::text[]`;

    await this.db
      .insert(providerUnmapped)
      .values({
        tmdbProviderId,
        lastSeenName,
        sampleNames: namesArray,
        sampleRegions: regionsArray,
        seenCount: count,
      })
      .onConflictDoUpdate({
        target: providerUnmapped.tmdbProviderId,
        set: {
          lastSeenName,
          lastSeenAt: sql`now()`,
          // Atomic increment
          seenCount: sql`${providerUnmapped.seenCount} + ${count}`,
          // Merge arrays: new first, dedupe by first occurrence, limit, preserve order
          sampleNames: sql`(
            WITH src AS (
              SELECT elem, ord
              FROM unnest(
                ${namesSql} || COALESCE(${providerUnmapped.sampleNames}, ARRAY[]::text[])
              ) WITH ORDINALITY AS t(elem, ord)
            ),
            dedup AS (
              SELECT elem, MIN(ord) AS ord
              FROM src
              GROUP BY elem
            )
            SELECT COALESCE(array_agg(elem ORDER BY ord), ARRAY[]::text[])
            FROM (SELECT elem, ord FROM dedup ORDER BY ord LIMIT ${MAX_SAMPLE_NAMES}) x
          )`,
          sampleRegions: sql`(
            WITH src AS (
              SELECT elem, ord
              FROM unnest(
                ${regionsSql} || COALESCE(${providerUnmapped.sampleRegions}, ARRAY[]::text[])
              ) WITH ORDINALITY AS t(elem, ord)
            ),
            dedup AS (
              SELECT elem, MIN(ord) AS ord
              FROM src
              GROUP BY elem
            )
            SELECT COALESCE(array_agg(elem ORDER BY ord), ARRAY[]::text[])
            FROM (SELECT elem, ord FROM dedup ORDER BY ord LIMIT ${MAX_SAMPLE_REGIONS}) x
          )`,
        },
      });
  }

  private toDomain(row: typeof providerUnmapped.$inferSelect): UnmappedProvider {
    return {
      tmdbProviderId: row.tmdbProviderId,
      lastSeenName: row.lastSeenName,
      sampleNames: row.sampleNames ?? [],
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      seenCount: row.seenCount,
      sampleRegions: row.sampleRegions ?? [],
    };
  }
}

interface AggregatedEntry {
  tmdbProviderId: number;
  lastSeenName: string;
  names: Set<string>;
  regions: Set<string>;
  count: number;
}
