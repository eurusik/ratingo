/**
 * Providers Query
 *
 * Returns active providers from provider_registry with media counts from media_watch_offers.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type ProviderInfo } from '../../domain/repositories/providers.repository.interface';

/**
 * Raw query result row from providers query.
 */
interface ProviderRow {
  id: string;
  name: string;
  count: number;
}

/**
 * Query object for getting streaming providers from catalog.
 */
@Injectable()
export class ProvidersQuery {
  private readonly logger = new Logger(ProvidersQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Gets active providers from registry with media counts.
   *
   * @returns {Promise<ProviderInfo[]>} Providers sorted by media count desc
   * @throws {DatabaseException} When database query fails
   */
  async execute(): Promise<ProviderInfo[]> {
    try {
      const result = await this.db.execute(sql`
        SELECT
          pr.id,
          pr.display_name as name,
          COALESCE(counts.count, 0)::int as count
        FROM ${schema.providerRegistry} pr
        LEFT JOIN (
          SELECT
            provider_id,
            COUNT(DISTINCT media_item_id) as count
          FROM ${schema.mediaWatchOffers}
          GROUP BY provider_id
        ) counts ON counts.provider_id = pr.id
        WHERE pr.is_active = true
        ORDER BY counts.count DESC NULLS LAST, pr.display_name ASC
      `);

      return (result as unknown as ProviderRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        count: row.count,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch providers: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch providers', error);
    }
  }
}
