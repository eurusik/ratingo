/**
 * Media Watch Offers Repository Implementation
 *
 * Drizzle-based repository for normalized watch offers.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, inArray } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { mediaWatchOffers } from '../../../../database/schema';
import type {
  CreateWatchOfferInput,
  FindOffersOptions,
  IMediaWatchOffersRepository,
} from '../../domain/repositories/media-watch-offers.repository.interface';
import type { MediaWatchOffer } from '../../domain/types/provider.types';

@Injectable()
export class MediaWatchOffersRepository implements IMediaWatchOffersRepository {
  private readonly logger = new Logger(MediaWatchOffersRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async upsertMany(
    mediaItemId: string,
    region: string,
    offers: CreateWatchOfferInput[],
  ): Promise<void> {
    if (offers.length === 0) return;

    try {
      // Replace-per-region strategy: DELETE existing, then INSERT
      await this.db.transaction(async (tx) => {
        // Delete existing offers for this media item + region
        await tx
          .delete(mediaWatchOffers)
          .where(
            and(eq(mediaWatchOffers.mediaItemId, mediaItemId), eq(mediaWatchOffers.region, region)),
          );

        // Insert new offers
        await tx.insert(mediaWatchOffers).values(
          offers.map((offer) => ({
            mediaItemId: offer.mediaItemId,
            providerId: offer.providerId,
            variantId: offer.variantId,
            distributionChannel: offer.distributionChannel,
            offerType: offer.offerType,
            region: offer.region,
            link: offer.link,
            tmdbProviderId: offer.tmdbProviderId,
          })),
        );
      });

      this.logger.debug(
        `Upserted ${offers.length} offers for media=${mediaItemId} region=${region}`,
      );
    } catch (error) {
      this.logger.error(`Failed to upsert offers for media=${mediaItemId} region=${region}`, error);
      throw error;
    }
  }

  async upsertManyByRegions(mediaItemId: string, offers: CreateWatchOfferInput[]): Promise<void> {
    if (offers.length === 0) return;

    // Group offers by region
    const offersByRegion = new Map<string, CreateWatchOfferInput[]>();
    for (const offer of offers) {
      const regionOffers = offersByRegion.get(offer.region) ?? [];
      regionOffers.push(offer);
      offersByRegion.set(offer.region, regionOffers);
    }

    // Upsert each region
    for (const [region, regionOffers] of offersByRegion) {
      await this.upsertMany(mediaItemId, region, regionOffers);
    }
  }

  async findByMediaItemId(
    mediaItemId: string,
    options?: FindOffersOptions,
  ): Promise<MediaWatchOffer[]> {
    try {
      const conditions = [eq(mediaWatchOffers.mediaItemId, mediaItemId)];

      if (options?.offerTypes?.length) {
        conditions.push(inArray(mediaWatchOffers.offerType, options.offerTypes));
      }

      if (options?.distributionChannels?.length) {
        conditions.push(
          inArray(mediaWatchOffers.distributionChannel, options.distributionChannels),
        );
      }

      if (options?.region) {
        conditions.push(eq(mediaWatchOffers.region, options.region));
      }

      const rows = await this.db
        .select()
        .from(mediaWatchOffers)
        .where(and(...conditions));

      return rows.map(this.toDomain);
    } catch (error) {
      this.logger.error(`Failed to find offers for media=${mediaItemId}`, error);
      throw error;
    }
  }

  async findByTmdbProviderId(tmdbProviderId: number): Promise<MediaWatchOffer[]> {
    try {
      const rows = await this.db
        .select()
        .from(mediaWatchOffers)
        .where(eq(mediaWatchOffers.tmdbProviderId, tmdbProviderId));

      return rows.map(this.toDomain);
    } catch (error) {
      this.logger.error(`Failed to find offers for tmdbProviderId=${tmdbProviderId}`, error);
      throw error;
    }
  }

  async findByMediaItemIds(
    mediaItemIds: string[],
    options?: FindOffersOptions,
  ): Promise<Map<string, MediaWatchOffer[]>> {
    if (mediaItemIds.length === 0) {
      return new Map();
    }

    try {
      const conditions = [inArray(mediaWatchOffers.mediaItemId, mediaItemIds)];

      if (options?.offerTypes?.length) {
        conditions.push(inArray(mediaWatchOffers.offerType, options.offerTypes));
      }

      if (options?.distributionChannels?.length) {
        conditions.push(
          inArray(mediaWatchOffers.distributionChannel, options.distributionChannels),
        );
      }

      if (options?.region) {
        conditions.push(eq(mediaWatchOffers.region, options.region));
      }

      const rows = await this.db
        .select()
        .from(mediaWatchOffers)
        .where(and(...conditions));

      // Group by media item
      const grouped = new Map<string, MediaWatchOffer[]>();
      for (const row of rows) {
        const offers = grouped.get(row.mediaItemId) ?? [];
        offers.push(this.toDomain(row));
        grouped.set(row.mediaItemId, offers);
      }

      return grouped;
    } catch (error) {
      this.logger.error(`Failed to find offers for ${mediaItemIds.length} media items`, error);
      throw error;
    }
  }

  async deleteByMediaItemId(mediaItemId: string): Promise<void> {
    try {
      await this.db.delete(mediaWatchOffers).where(eq(mediaWatchOffers.mediaItemId, mediaItemId));

      this.logger.debug(`Deleted all offers for media=${mediaItemId}`);
    } catch (error) {
      this.logger.error(`Failed to delete offers for media=${mediaItemId}`, error);
      throw error;
    }
  }

  async deleteByMediaItemIdAndRegion(mediaItemId: string, region: string): Promise<void> {
    try {
      await this.db
        .delete(mediaWatchOffers)
        .where(
          and(eq(mediaWatchOffers.mediaItemId, mediaItemId), eq(mediaWatchOffers.region, region)),
        );

      this.logger.debug(`Deleted offers for media=${mediaItemId} region=${region}`);
    } catch (error) {
      this.logger.error(`Failed to delete offers for media=${mediaItemId} region=${region}`, error);
      throw error;
    }
  }

  private toDomain(row: typeof mediaWatchOffers.$inferSelect): MediaWatchOffer {
    return {
      id: row.id,
      mediaItemId: row.mediaItemId,
      providerId: row.providerId,
      variantId: row.variantId,
      distributionChannel: row.distributionChannel,
      offerType: row.offerType,
      region: row.region,
      link: row.link,
      tmdbProviderId: row.tmdbProviderId,
      updatedAt: row.updatedAt,
    };
  }
}
