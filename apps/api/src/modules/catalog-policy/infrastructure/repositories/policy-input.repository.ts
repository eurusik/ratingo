/**
 * Policy Input Repository
 *
 * Infrastructure implementation of IPolicyInputRepository.
 * Fetches media item data and transforms it into PolicyEngineInput format.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';

import { eq, inArray, isNull, and, gt, lte, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type IMediaWatchOffersRepository,
  MEDIA_WATCH_OFFERS_REPOSITORY,
} from '../../../provider/public';
import { mapOffersToNormalized } from '../../application/utils/offer-mapper';
import {
  type MediaItemRow,
  mapRowToPolicyEngineInput,
  mapRowsToPolicyEngineInputs,
  POLICY_EVALUATION_SELECT_FIELDS,
} from '../../application/utils/policy-input.mapper';
import {
  type IPolicyInputRepository,
  type FetchBatchIdsOptions,
} from '../../domain/repositories/policy-input.repository.interface';
import { type PolicyEngineInput, type NormalizedOffer } from '../../domain/types/policy.types';

@Injectable()
export class PolicyInputRepository implements IPolicyInputRepository {
  private readonly logger = new Logger(PolicyInputRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(MEDIA_WATCH_OFFERS_REPOSITORY)
    private readonly watchOffersRepository: IMediaWatchOffersRepository,
  ) {}

  /**
   * Fetches PolicyEngineInput for a single media item.
   */
  async findOneForEvaluation(mediaItemId: string): Promise<PolicyEngineInput | null> {
    const result = await this.db
      .select(POLICY_EVALUATION_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(eq(schema.mediaItems.id, mediaItemId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    // Fetch normalized offers for this media item
    const offersMap = await this.watchOffersRepository.getOffersForMediaBatch([mediaItemId], {
      includeVariantInfo: true,
    });
    const normalizedOffers = mapOffersToNormalized(offersMap.get(mediaItemId) ?? []);

    return mapRowToPolicyEngineInput(result[0] as MediaItemRow, normalizedOffers, this.logger);
  }

  /**
   * Fetches PolicyEngineInputs for multiple media items (batch).
   */
  async findManyForEvaluation(mediaItemIds: string[]): Promise<PolicyEngineInput[]> {
    if (mediaItemIds.length === 0) {
      return [];
    }

    const result = await this.db
      .select(POLICY_EVALUATION_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(inArray(schema.mediaItems.id, mediaItemIds));

    // Fetch normalized offers for all media items in batch
    const offersMap = await this.watchOffersRepository.getOffersForMediaBatch(mediaItemIds, {
      includeVariantInfo: true,
    });

    // Convert MediaWatchOfferView to NormalizedOffer
    const normalizedOffersMap = new Map<string, NormalizedOffer[]>();
    for (const [id, offers] of offersMap) {
      normalizedOffersMap.set(id, mapOffersToNormalized(offers));
    }

    return mapRowsToPolicyEngineInputs(result as MediaItemRow[], normalizedOffersMap, this.logger);
  }

  /**
   * Counts total eligible items for evaluation.
   * Uses same filters as fetchBatchIds for consistency.
   */
  async countEligibleItems(): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.mediaItems)
      .where(
        and(
          eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
          isNull(schema.mediaItems.deletedAt),
        ),
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Fetches batch of media item IDs for re-evaluation.
   * Uses cursor-based pagination with ordered results.
   */
  async fetchBatchIds(options: FetchBatchIdsOptions): Promise<string[]> {
    const { batchSize, cursor, snapshotCutoff } = options;

    const conditions = [
      eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
      isNull(schema.mediaItems.deletedAt),
    ];

    if (snapshotCutoff) {
      conditions.push(lte(schema.mediaItems.updatedAt, snapshotCutoff));
    }

    if (cursor) {
      conditions.push(gt(schema.mediaItems.id, cursor));
    }

    const result = await this.db
      .select({ id: schema.mediaItems.id })
      .from(schema.mediaItems)
      .where(and(...conditions))
      .orderBy(schema.mediaItems.id)
      .limit(batchSize);

    return result.map((row) => row.id);
  }
}
