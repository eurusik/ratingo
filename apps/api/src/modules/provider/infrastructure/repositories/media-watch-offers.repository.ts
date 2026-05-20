/**
 * Media Watch Offers Repository Implementation
 *
 * Drizzle-based repository for normalized watch offers.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, inArray } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { mediaWatchOffers, providerVariants } from '../../../../database/schema';
import type {
  CreateWatchOfferInput,
  FindOffersOptions,
  GetOffersForMediaBatchOptions,
  IMediaWatchOffersRepository,
  MediaWatchOfferView,
} from '../../domain/repositories/media-watch-offers.repository.interface';
import type {
  DistributionChannel,
  MediaWatchOffer,
  OfferType,
} from '../../domain/types/provider.types';

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

    await withDbError(
      'upsertMany',
      this.logger,
      async () => {
        await this.db.transaction(async (tx) => {
          await tx
            .delete(mediaWatchOffers)
            .where(
              and(
                eq(mediaWatchOffers.mediaItemId, mediaItemId),
                eq(mediaWatchOffers.region, region),
              ),
            );

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
      },
      { mediaItemId, region },
    );
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

    await withDbError(
      'upsertManyByRegions',
      this.logger,
      async () => {
        await this.db.transaction(async (tx) => {
          for (const [region, regionOffers] of offersByRegion) {
            await tx
              .delete(mediaWatchOffers)
              .where(
                and(
                  eq(mediaWatchOffers.mediaItemId, mediaItemId),
                  eq(mediaWatchOffers.region, region),
                ),
              );

            await tx.insert(mediaWatchOffers).values(
              regionOffers.map((offer) => ({
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
          }
        });
      },
      { mediaItemId, regionCount: offersByRegion.size },
    );
  }

  async findByMediaItemId(
    mediaItemId: string,
    options?: FindOffersOptions,
  ): Promise<MediaWatchOffer[]> {
    return withDbError(
      'findByMediaItemId',
      this.logger,
      async () => {
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
      },
      { mediaItemId },
    );
  }

  async findByTmdbProviderId(tmdbProviderId: number): Promise<MediaWatchOffer[]> {
    return withDbError(
      'findByTmdbProviderId',
      this.logger,
      async () => {
        const rows = await this.db
          .select()
          .from(mediaWatchOffers)
          .where(eq(mediaWatchOffers.tmdbProviderId, tmdbProviderId));

        return rows.map(this.toDomain);
      },
      { tmdbProviderId },
    );
  }

  async findByMediaItemIds(
    mediaItemIds: string[],
    options?: FindOffersOptions,
  ): Promise<Map<string, MediaWatchOffer[]>> {
    if (mediaItemIds.length === 0) {
      return new Map();
    }

    return withDbError(
      'findByMediaItemIds',
      this.logger,
      async () => {
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

        const grouped = new Map<string, MediaWatchOffer[]>();
        for (const row of rows) {
          const offers = grouped.get(row.mediaItemId) ?? [];
          offers.push(this.toDomain(row));
          grouped.set(row.mediaItemId, offers);
        }

        return grouped;
      },
      { count: mediaItemIds.length },
    );
  }

  async deleteByMediaItemId(mediaItemId: string): Promise<void> {
    await withDbError(
      'deleteByMediaItemId',
      this.logger,
      async () => {
        await this.db.delete(mediaWatchOffers).where(eq(mediaWatchOffers.mediaItemId, mediaItemId));
        this.logger.debug(`Deleted all offers for media=${mediaItemId}`);
      },
      { mediaItemId },
    );
  }

  async deleteByMediaItemIdAndRegion(mediaItemId: string, region: string): Promise<void> {
    await withDbError(
      'deleteByMediaItemIdAndRegion',
      this.logger,
      async () => {
        await this.db
          .delete(mediaWatchOffers)
          .where(
            and(eq(mediaWatchOffers.mediaItemId, mediaItemId), eq(mediaWatchOffers.region, region)),
          );
        this.logger.debug(`Deleted offers for media=${mediaItemId} region=${region}`);
      },
      { mediaItemId, region },
    );
  }

  async getOffersForMediaBatch(
    mediaItemIds: string[],
    options?: GetOffersForMediaBatchOptions,
  ): Promise<Map<string, MediaWatchOfferView[]>> {
    if (mediaItemIds.length === 0) {
      return new Map();
    }

    return withDbError(
      'getOffersForMediaBatch',
      this.logger,
      async () => {
        const conditions = [inArray(mediaWatchOffers.mediaItemId, mediaItemIds)];

        if (options?.offerTypes?.length) {
          conditions.push(inArray(mediaWatchOffers.offerType, options.offerTypes));
        }

        if (options?.distributionChannels?.length) {
          conditions.push(
            inArray(mediaWatchOffers.distributionChannel, options.distributionChannels),
          );
        }

        if (options?.includeVariantInfo) {
          const rows = await this.db
            .select({
              mediaItemId: mediaWatchOffers.mediaItemId,
              providerId: mediaWatchOffers.providerId,
              offerType: mediaWatchOffers.offerType,
              distributionChannel: mediaWatchOffers.distributionChannel,
              variantId: mediaWatchOffers.variantId,
              isAdsTier: providerVariants.isAdsTier,
            })
            .from(mediaWatchOffers)
            .leftJoin(providerVariants, eq(mediaWatchOffers.variantId, providerVariants.id))
            .where(and(...conditions));

          return this.groupOfferViewsWithVariant(rows);
        }

        const rows = await this.db
          .select({
            mediaItemId: mediaWatchOffers.mediaItemId,
            providerId: mediaWatchOffers.providerId,
            offerType: mediaWatchOffers.offerType,
            distributionChannel: mediaWatchOffers.distributionChannel,
          })
          .from(mediaWatchOffers)
          .where(and(...conditions));

        return this.groupOfferViews(rows);
      },
      { count: mediaItemIds.length },
    );
  }

  private groupOfferViews(
    rows: Array<{
      mediaItemId: string;
      providerId: string;
      offerType: OfferType;
      distributionChannel: DistributionChannel;
    }>,
  ): Map<string, MediaWatchOfferView[]> {
    const grouped = new Map<string, MediaWatchOfferView[]>();

    for (const row of rows) {
      const offers = grouped.get(row.mediaItemId) ?? [];
      offers.push({
        providerId: row.providerId,
        offerType: row.offerType,
        distributionChannel: row.distributionChannel,
      });
      grouped.set(row.mediaItemId, offers);
    }

    return grouped;
  }

  private groupOfferViewsWithVariant(
    rows: Array<{
      mediaItemId: string;
      providerId: string;
      offerType: OfferType;
      distributionChannel: DistributionChannel;
      variantId: string | null;
      isAdsTier: boolean | null;
    }>,
  ): Map<string, MediaWatchOfferView[]> {
    const grouped = new Map<string, MediaWatchOfferView[]>();

    for (const row of rows) {
      const offers = grouped.get(row.mediaItemId) ?? [];
      offers.push({
        providerId: row.providerId,
        offerType: row.offerType,
        distributionChannel: row.distributionChannel,
        // variantIsAdsTier: true only if variant exists AND is ads tier
        // null variant = standard tier (not ads)
        variantIsAdsTier: row.variantId !== null ? (row.isAdsTier ?? false) : false,
      });
      grouped.set(row.mediaItemId, offers);
    }

    return grouped;
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
