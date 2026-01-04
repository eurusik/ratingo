/**
 * Provider Mapping Repository
 *
 * Drizzle implementation for TMDB to canonical provider mappings.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, inArray } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type IProviderMappingRepository } from '../../domain/repositories/provider-mapping.repository.interface';
import type {
  ProviderMapping,
  CreateMappingDto,
  UpdateMappingDto,
  ResolvedMapping,
  DistributionChannel,
  MappingSource,
} from '../../domain/types/provider.types';
import { normalizeRegion, GLOBAL_REGION } from '../../domain/utils/region-normalizer';

type DbMapping = typeof schema.providerMappings.$inferSelect;

@Injectable()
export class ProviderMappingRepository implements IProviderMappingRepository {
  private readonly logger = new Logger(ProviderMappingRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findByTmdbIdAndRegion(
    tmdbProviderId: number,
    region: string,
  ): Promise<ProviderMapping | null> {
    try {
      const normalizedRegion = normalizeRegion(region);

      const result = await this.db
        .select()
        .from(schema.providerMappings)
        .where(
          and(
            eq(schema.providerMappings.tmdbProviderId, tmdbProviderId),
            eq(schema.providerMappings.region, normalizedRegion),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to find mapping for TMDB ${tmdbProviderId}`, error);
      throw new DatabaseException(`Failed to find mapping for TMDB ${tmdbProviderId}`, error);
    }
  }

  async findManyByTmdbIdsAndRegion(
    tmdbProviderIds: number[],
    region: string,
  ): Promise<Map<number, ProviderMapping>> {
    if (tmdbProviderIds.length === 0) {
      return new Map();
    }

    try {
      const normalizedRegion = normalizeRegion(region);

      const result = await this.db
        .select()
        .from(schema.providerMappings)
        .where(
          and(
            inArray(schema.providerMappings.tmdbProviderId, tmdbProviderIds),
            eq(schema.providerMappings.region, normalizedRegion),
          ),
        );

      const map = new Map<number, ProviderMapping>();
      for (const row of result) {
        map.set(row.tmdbProviderId, this.mapToEntity(row));
      }

      return map;
    } catch (error) {
      this.logger.error(`Failed to find mappings for ${tmdbProviderIds.length} TMDB IDs`, error);
      throw new DatabaseException('Failed to find mappings', error);
    }
  }

  async findByRegion(region: string): Promise<ProviderMapping[]> {
    try {
      const normalizedRegion = normalizeRegion(region);

      const result = await this.db
        .select()
        .from(schema.providerMappings)
        .where(eq(schema.providerMappings.region, normalizedRegion));

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error(`Failed to find mappings for region ${region}`, error);
      throw new DatabaseException(`Failed to find mappings for region ${region}`, error);
    }
  }

  async findAll(options?: {
    providerId?: string;
    region?: string;
    includeGlobal?: boolean;
  }): Promise<ProviderMapping[]> {
    try {
      const conditions = [];

      if (options?.providerId) {
        conditions.push(eq(schema.providerMappings.providerId, options.providerId));
      }

      if (options?.region) {
        const normalizedRegion = normalizeRegion(options.region);
        if (options.includeGlobal !== false && normalizedRegion !== GLOBAL_REGION) {
          // Include both region-specific and global
          conditions.push(
            inArray(schema.providerMappings.region, [normalizedRegion, GLOBAL_REGION]),
          );
        } else {
          conditions.push(eq(schema.providerMappings.region, normalizedRegion));
        }
      }

      const query = this.db.select().from(schema.providerMappings);

      const result = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error('Failed to find all mappings', error);
      throw new DatabaseException('Failed to find all mappings', error);
    }
  }

  async findById(id: string): Promise<ProviderMapping | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.providerMappings)
        .where(eq(schema.providerMappings.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to find mapping ${id}`, error);
      throw new DatabaseException(`Failed to find mapping ${id}`, error);
    }
  }

  async create(data: CreateMappingDto): Promise<ProviderMapping> {
    try {
      const normalizedRegion = normalizeRegion(data.region);

      const result = await this.db
        .insert(schema.providerMappings)
        .values({
          tmdbProviderId: data.tmdbProviderId,
          providerId: data.providerId,
          variantId: data.variantId ?? null,
          distributionChannel: data.distributionChannel ?? 'direct',
          region: normalizedRegion,
          notes: data.notes ?? null,
          source: data.source ?? 'manual',
          createdAt: new Date(),
        })
        .returning();

      this.logger.log(`Created mapping TMDB ${data.tmdbProviderId} -> ${data.providerId}`);

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to create mapping for TMDB ${data.tmdbProviderId}`, error);
      throw new DatabaseException(
        `Failed to create mapping for TMDB ${data.tmdbProviderId}`,
        error,
      );
    }
  }

  async update(id: string, data: UpdateMappingDto): Promise<ProviderMapping> {
    try {
      const updateData: Partial<typeof schema.providerMappings.$inferInsert> = {};

      if (data.providerId !== undefined) updateData.providerId = data.providerId;
      if (data.variantId !== undefined) updateData.variantId = data.variantId;
      if (data.distributionChannel !== undefined) {
        updateData.distributionChannel = data.distributionChannel;
      }
      if (data.notes !== undefined) updateData.notes = data.notes;

      const result = await this.db
        .update(schema.providerMappings)
        .set(updateData)
        .where(eq(schema.providerMappings.id, id))
        .returning();

      if (result.length === 0) {
        throw new DatabaseException(`Mapping ${id} not found`);
      }

      this.logger.log(`Updated mapping ${id}`);

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to update mapping ${id}`, error);
      throw new DatabaseException(`Failed to update mapping ${id}`, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.db
        .delete(schema.providerMappings)
        .where(eq(schema.providerMappings.id, id))
        .returning();

      if (result.length === 0) {
        throw new DatabaseException(`Mapping ${id} not found`);
      }

      this.logger.log(`Deleted mapping ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete mapping ${id}`, error);
      throw new DatabaseException(`Failed to delete mapping ${id}`, error);
    }
  }

  async resolve(tmdbProviderId: number, region: string): Promise<ResolvedMapping | null> {
    const normalizedRegion = normalizeRegion(region);

    // Try region-specific first
    const regionMapping = await this.findByTmdbIdAndRegion(tmdbProviderId, normalizedRegion);
    if (regionMapping) {
      return this.toResolvedMapping(regionMapping);
    }

    // Fall back to global if not global already
    if (normalizedRegion !== GLOBAL_REGION) {
      const globalMapping = await this.findByTmdbIdAndRegion(tmdbProviderId, GLOBAL_REGION);
      if (globalMapping) {
        return this.toResolvedMapping(globalMapping);
      }
    }

    return null;
  }

  async resolveMany(
    tmdbProviderIds: number[],
    region: string,
  ): Promise<Map<number, ResolvedMapping>> {
    if (tmdbProviderIds.length === 0) {
      return new Map();
    }

    const normalizedRegion = normalizeRegion(region);
    const result = new Map<number, ResolvedMapping>();

    // Query 1: Get region-specific mappings
    const regionMappings = await this.findManyByTmdbIdsAndRegion(tmdbProviderIds, normalizedRegion);

    for (const [tmdbId, mapping] of regionMappings) {
      result.set(tmdbId, this.toResolvedMapping(mapping));
    }

    // Query 2: Get global mappings for missing IDs (if not already global)
    if (normalizedRegion !== GLOBAL_REGION) {
      const missingIds = tmdbProviderIds.filter((id) => !result.has(id));

      if (missingIds.length > 0) {
        const globalMappings = await this.findManyByTmdbIdsAndRegion(missingIds, GLOBAL_REGION);

        for (const [tmdbId, mapping] of globalMappings) {
          result.set(tmdbId, this.toResolvedMapping(mapping));
        }
      }
    }

    return result;
  }

  private mapToEntity(row: DbMapping): ProviderMapping {
    return {
      id: row.id,
      tmdbProviderId: row.tmdbProviderId,
      providerId: row.providerId,
      variantId: row.variantId,
      distributionChannel: row.distributionChannel as DistributionChannel,
      region: row.region,
      notes: row.notes,
      source: row.source as MappingSource,
      createdAt: row.createdAt,
    };
  }

  private toResolvedMapping(mapping: ProviderMapping): ResolvedMapping {
    return {
      providerId: mapping.providerId,
      variantId: mapping.variantId,
      distributionChannel: mapping.distributionChannel,
    };
  }
}
