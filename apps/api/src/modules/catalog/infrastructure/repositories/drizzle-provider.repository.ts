import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, inArray } from 'drizzle-orm';
import { DatabaseException } from '../../../../common/exceptions';
import { IProviderRepository, WatchProviderData, DbTransaction } from '../../domain/repositories/provider.repository.interface';

/**
 * Drizzle implementation of IProviderRepository.
 * Handles watch provider-related database operations.
 */
@Injectable()
export class DrizzleProviderRepository implements IProviderRepository {
  private readonly logger = new Logger(DrizzleProviderRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Syncs watch providers for a media item within a transaction.
   * Updates provider registry and links providers to the media item.
   */
  async syncProviders(
    tx: DbTransaction,
    mediaId: string,
    providers: WatchProviderData[],
  ): Promise<void> {
    if (providers.length === 0) return;

    try {
      const uniqueProviders = Array.from(
        new Map(providers.map(p => [p.providerId, p])).values()
      );

      // Upsert providers registry (individual upserts for type-safety)
      for (const p of uniqueProviders) {
        await tx
          .insert(schema.watchProviders)
          .values({
            tmdbId: p.providerId,
            name: p.name,
            logoPath: p.logoPath,
            displayPriority: p.displayPriority,
          })
          .onConflictDoUpdate({
            target: schema.watchProviders.tmdbId,
            set: {
              name: p.name,
              logoPath: p.logoPath,
            },
          });
      }

      // Get internal IDs
      const providerRows = await tx
        .select({ id: schema.watchProviders.id, tmdbId: schema.watchProviders.tmdbId })
        .from(schema.watchProviders)
        .where(inArray(schema.watchProviders.tmdbId, providers.map(p => p.providerId)));

      const providerMap = new Map<number, string>(providerRows.map(r => [r.tmdbId, r.id]));

      // Delete old links (clean slate for this media item)
      await tx
        .delete(schema.mediaWatchProviders)
        .where(eq(schema.mediaWatchProviders.mediaItemId, mediaId));

      // Insert new links
      const links: Array<{ mediaItemId: string; providerId: string; type: string }> = [];
      for (const p of providers) {
        const internalId = providerMap.get(p.providerId);
        if (internalId) {
          links.push({
            mediaItemId: mediaId,
            providerId: internalId,
            type: p.type,
          });
        }
      }

      if (links.length > 0) {
        await tx.insert(schema.mediaWatchProviders).values(links);
      }
    } catch (error) {
      this.logger.error(`Failed to sync providers for media ${mediaId}: ${error.message}`);
      throw new DatabaseException(`Failed to sync providers: ${error.message}`, { mediaId });
    }
  }
}
