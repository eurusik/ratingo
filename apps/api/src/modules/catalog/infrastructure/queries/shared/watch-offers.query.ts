import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, inArray } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { AVAILABILITY_REGIONS } from '../../../../../common/constants/region.constants';
import { withDbError } from '../../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../../database/database.module';
import * as schema from '../../../../../database/schema';
import { type WatchOfferRow } from '../../mappers/media-watch-offers.mapper';

/**
 * Shared query for fetching watch offers from media_watch_offers.
 * Used by movie-details and show-details queries.
 */
@Injectable()
export class WatchOffersQuery {
  private readonly logger = new Logger(WatchOffersQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Fetches watch offers for a media item.
   * Joins with provider_registry to get display names and logos.
   * Filters to UA/US regions only.
   */
  async fetchForMediaItem(mediaItemId: string): Promise<WatchOfferRow[]> {
    return withDbError(
      'fetch watch offers for media item',
      this.logger,
      async () => {
        const rows = await this.db
          .select({
            providerId: schema.mediaWatchOffers.providerId,
            displayName: schema.providerRegistry.displayName,
            logoPath: schema.providerRegistry.logoPath,
            priority: schema.providerRegistry.priority,
            offerType: schema.mediaWatchOffers.offerType,
            region: schema.mediaWatchOffers.region,
            link: schema.mediaWatchOffers.link,
          })
          .from(schema.mediaWatchOffers)
          .innerJoin(
            schema.providerRegistry,
            eq(schema.mediaWatchOffers.providerId, schema.providerRegistry.id),
          )
          .where(
            and(
              eq(schema.mediaWatchOffers.mediaItemId, mediaItemId),
              inArray(schema.mediaWatchOffers.region, [...AVAILABILITY_REGIONS]),
            ),
          );

        return rows as WatchOfferRow[];
      },
      { mediaItemId },
    );
  }
}
