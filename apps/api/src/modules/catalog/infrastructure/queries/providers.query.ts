/**
 * Providers Query
 *
 * Returns active providers from provider_registry with media counts from media_watch_offers.
 */

import { Inject, Injectable } from '@nestjs/common';

import { sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import type * as schema from '../../../../database/schema';
import { type ProviderInfo } from '../../domain/repositories/providers.repository.interface';

/**
 * Query object for getting streaming providers from catalog.
 */
@Injectable()
export class ProvidersQuery {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Gets active providers from registry with media counts.
   *
   * @returns {Promise<ProviderInfo[]>} Providers sorted by media count desc
   */
  async execute(): Promise<ProviderInfo[]> {
    const result = await this.db.execute(sql`
      SELECT 
        pr.id,
        pr.display_name as name,
        COALESCE(counts.count, 0)::int as count
      FROM provider_registry pr
      LEFT JOIN (
        SELECT 
          provider_id,
          COUNT(DISTINCT media_item_id) as count
        FROM media_watch_offers
        GROUP BY provider_id
      ) counts ON counts.provider_id = pr.id
      WHERE pr.is_active = true
      ORDER BY counts.count DESC NULLS LAST, pr.display_name ASC
    `);

    return (result as unknown as ProviderInfo[]).map((row) => ({
      id: row.id,
      name: row.name,
      count: row.count,
    }));
  }
}
