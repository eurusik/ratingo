/**
 * Providers Repository
 *
 * Extracts unique streaming providers from media_items.watch_providers JSONB field.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { sql } from 'drizzle-orm';
import { DatabaseException } from '../../../../common/exceptions';

export const PROVIDERS_REPOSITORY = 'PROVIDERS_REPOSITORY';

/** Provider info with media count. */
export interface ProviderInfo {
  id: string;
  name: string;
  count: number;
}

/** Providers repository interface. */
export interface IProvidersRepository {
  findAllProviders(): Promise<ProviderInfo[]>;
}

@Injectable()
export class ProvidersRepository implements IProvidersRepository {
  private readonly logger = new Logger(ProvidersRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Gets unique streaming providers from catalog.
   *
   * Extracts provider name from watch_providers JSONB across all regions.
   * Structure: { "US": { "flatrate": [...], "buy": [...], "rent": [...] } }
   *
   * @returns {Promise<ProviderInfo[]>} Providers sorted by media count desc
   * @throws {DatabaseException} On query failure
   */
  async findAllProviders(): Promise<ProviderInfo[]> {
    try {
      // Extract unique providers from JSONB
      // Checks flatrate, buy, and rent arrays across all regions
      const result = await this.db.execute(sql`
        WITH all_providers AS (
          SELECT DISTINCT
            LOWER(provider->>'name') as id,
            provider->>'name' as name
          FROM media_items,
            jsonb_each(watch_providers) as regions(region_code, region_data),
            LATERAL (
              SELECT jsonb_array_elements(
                COALESCE(region_data->'flatrate', '[]'::jsonb) ||
                COALESCE(region_data->'buy', '[]'::jsonb) ||
                COALESCE(region_data->'rent', '[]'::jsonb)
              ) as provider
            ) as providers
          WHERE watch_providers IS NOT NULL
            AND watch_providers != '{}'::jsonb
            AND deleted_at IS NULL
            AND provider->>'name' IS NOT NULL
        ),
        provider_counts AS (
          SELECT 
            LOWER(provider->>'name') as id,
            COUNT(DISTINCT media_items.id) as count
          FROM media_items,
            jsonb_each(watch_providers) as regions(region_code, region_data),
            LATERAL (
              SELECT jsonb_array_elements(
                COALESCE(region_data->'flatrate', '[]'::jsonb) ||
                COALESCE(region_data->'buy', '[]'::jsonb) ||
                COALESCE(region_data->'rent', '[]'::jsonb)
              ) as provider
            ) as providers
          WHERE watch_providers IS NOT NULL
            AND watch_providers != '{}'::jsonb
            AND deleted_at IS NULL
            AND provider->>'name' IS NOT NULL
          GROUP BY LOWER(provider->>'name')
        )
        SELECT 
          p.id,
          p.name,
          COALESCE(pc.count, 0)::int as count
        FROM all_providers p
        LEFT JOIN provider_counts pc ON p.id = pc.id
        ORDER BY pc.count DESC NULLS LAST, p.name ASC
      `);

      return (result as unknown as ProviderInfo[]).map((row) => ({
        id: row.id,
        name: row.name,
        count: row.count,
      }));
    } catch (error) {
      this.logger.error('Failed to extract providers from media items', error);
      throw new DatabaseException('Failed to extract providers', error);
    }
  }
}
