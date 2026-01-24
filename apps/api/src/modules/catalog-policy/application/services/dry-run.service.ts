/**
 * Dry-Run Service
 *
 * Evaluates media items against a proposed policy WITHOUT persisting results.
 * Used for previewing policy changes before activation.
 *
 * Supports multiple selection modes:
 * - sample: Random sample using TABLESAMPLE (DD-6)
 * - top: Top items by trending/popularity score
 * - byType: Filter by media type (movie/show)
 * - byCountry: Filter by origin country
 *
 * Limits: max 10000 items, 60s timeout
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type IMediaWatchOffersRepository,
  MEDIA_WATCH_OFFERS_REPOSITORY,
} from '../../../provider/public';
import {
  EligibilityStatus,
  type EligibilityStatusType,
  type EvaluationReasonType,
} from '../../domain/constants/evaluation.constants';
import { evaluateEligibility, computeRelevance } from '../../domain/policy-engine';
import { type PolicyConfig } from '../../domain/types/policy.types';
import { mapOffersToNormalized } from '../utils/offer-mapper';
import {
  type MediaItemRow,
  mapRowToPolicyEngineInput,
  POLICY_EVALUATION_SELECT_FIELDS,
} from '../utils/policy-input.mapper';

import { CatalogPolicyService } from './catalog-policy.service';

/**
 * Dry-run selection mode
 */
export type DryRunMode = 'sample' | 'top' | 'byType' | 'byCountry';

/**
 * Dry-run options
 */
export interface DryRunOptions {
  mode: DryRunMode;
  limit?: number; // Max items to evaluate (default: 1000, max: 10000)
  mediaType?: 'movie' | 'show'; // For byType mode
  country?: string; // For byCountry mode (ISO 3166-1 alpha-2)
  samplePercent?: number; // For sample mode (1-100)
}

/**
 * Single item dry-run result
 */
export interface DryRunItemResult {
  mediaItemId: string;
  title: string;
  currentStatus: EligibilityStatusType | null;
  proposedStatus: EligibilityStatusType;
  reasons: EvaluationReasonType[];
  relevanceScore: number;
  breakoutRuleId: string | null;
  statusChanged: boolean;
}

/**
 * Reason breakdown in summary
 */
export interface ReasonBreakdown {
  reason: EvaluationReasonType;
  count: number;
}

/**
 * Dry-run summary
 */
export interface DryRunSummary {
  totalEvaluated: number;
  eligible: number;
  ineligible: number;
  review: number;
  newlyEligible: number;
  newlyIneligible: number;
  unchanged: number;
  reasonBreakdown: ReasonBreakdown[];
  executionTimeMs: number;
  mode: DryRunMode;
  limit: number;
}

/**
 * Full dry-run result
 */
export interface DryRunResult {
  summary: DryRunSummary;
  items: DryRunItemResult[];
}

// Constants
const MAX_ITEMS = 10000;
const DEFAULT_LIMIT = 1000;
const MAX_SAMPLE_PERCENT = 100;
const DEFAULT_SAMPLE_PERCENT = 10;
const MIN_SAMPLE_PERCENT = 1;
const SAMPLE_DIVISOR = 100;

/**
 * Timeout for dry-run execution in milliseconds.
 * Can be overridden via DRY_RUN_TIMEOUT_MS environment variable.
 */
const TIMEOUT_MS = parseInt(process.env.DRY_RUN_TIMEOUT_MS || '60000', 10);

@Injectable()
export class DryRunService {
  private readonly logger = new Logger(DryRunService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly policyService: CatalogPolicyService,
    @Inject(MEDIA_WATCH_OFFERS_REPOSITORY)
    private readonly watchOffersRepository: IMediaWatchOffersRepository,
  ) {}

  /**
   * Execute dry-run evaluation against a proposed policy.
   * Does NOT modify the database.
   *
   * @param proposedPolicy - Policy configuration to test
   * @param options - Selection mode and limits
   * @returns Dry-run results with summary and item details
   */
  async execute(proposedPolicy: PolicyConfig, options: DryRunOptions): Promise<DryRunResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || DEFAULT_LIMIT, MAX_ITEMS);

    this.logger.log(`Starting dry-run: mode=${options.mode}, limit=${limit}`);

    // Validate options
    this.validateOptions(options);

    // Fetch items based on mode
    const items = await this.fetchItems(options, limit);

    if (items.length === 0) {
      return this.buildEmptyResult(options.mode, limit, Date.now() - startTime);
    }

    // Get current evaluations for comparison
    const currentEvaluations = await this.getCurrentEvaluations(items.map((i) => i.id));

    // Fetch normalized offers for all items in batch
    const mediaItemIds = items.map((i) => i.id);
    const offersMap = await this.watchOffersRepository.getOffersForMediaBatch(mediaItemIds, {
      includeVariantInfo: true,
    });

    // Evaluate each item
    const results: DryRunItemResult[] = [];
    const reasonCounts: Record<string, number> = {};
    let eligible = 0;
    let ineligible = 0;
    let review = 0;
    let newlyEligible = 0;
    let newlyIneligible = 0;
    let unchanged = 0;

    for (const item of items) {
      // Check timeout
      if (Date.now() - startTime > TIMEOUT_MS) {
        this.logger.warn(`Dry-run timeout reached after ${results.length} items`);
        break;
      }

      const normalizedOffers = mapOffersToNormalized(offersMap.get(item.id) ?? []);
      const input = mapRowToPolicyEngineInput(item, normalizedOffers, this.logger);
      const evalResult = evaluateEligibility(input, proposedPolicy);
      const relevanceScore = computeRelevance(input, proposedPolicy);

      const currentEval = currentEvaluations.get(item.id);
      const currentStatus = currentEval?.status || null;
      const statusChanged = currentStatus !== evalResult.status;

      // Count statuses using constants
      // Note: Per Readability & Pending Reform, PENDING is no longer returned by Policy Engine
      switch (evalResult.status) {
        case EligibilityStatus.ELIGIBLE:
          eligible++;
          if (currentStatus && currentStatus !== EligibilityStatus.ELIGIBLE) newlyEligible++;
          break;
        case EligibilityStatus.INELIGIBLE:
          ineligible++;
          if (currentStatus && currentStatus !== EligibilityStatus.INELIGIBLE) newlyIneligible++;
          break;
        // PENDING case removed per Readability & Pending Reform
        // Policy Engine now returns INELIGIBLE with specific reasons for missing data
        case EligibilityStatus.REVIEW:
          review++;
          break;
      }

      if (!statusChanged) unchanged++;

      // Count reasons
      for (const reason of evalResult.reasons) {
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      }

      results.push({
        mediaItemId: item.id,
        title: item.title,
        currentStatus: currentStatus as EligibilityStatusType | null,
        proposedStatus: evalResult.status,
        reasons: evalResult.reasons,
        relevanceScore,
        breakoutRuleId: evalResult.breakoutRuleId,
        statusChanged,
      });
    }

    const executionTimeMs = Date.now() - startTime;

    // Build reason breakdown
    const reasonBreakdown: ReasonBreakdown[] = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason: reason as EvaluationReasonType, count }))
      .sort((a, b) => b.count - a.count);

    this.logger.log(
      `Dry-run complete: ${results.length} items in ${executionTimeMs}ms. ` +
        `Eligible: ${eligible}, Ineligible: ${ineligible}`,
    );

    return {
      summary: {
        totalEvaluated: results.length,
        eligible,
        ineligible,
        review,
        newlyEligible,
        newlyIneligible,
        unchanged,
        reasonBreakdown,
        executionTimeMs,
        mode: options.mode,
        limit,
      },
      items: results,
    };
  }

  /**
   * Execute diff mode - compare proposed policy against current active policy.
   */
  async executeDiff(
    proposedPolicy: PolicyConfig,
    options: DryRunOptions,
  ): Promise<DryRunResult & { currentPolicyVersion: number | null }> {
    const activePolicy = await this.policyService.getActive();
    const result = await this.execute(proposedPolicy, options);

    return {
      ...result,
      currentPolicyVersion: activePolicy?.version || null,
    };
  }

  /**
   * Validate dry-run options
   */
  private validateOptions(options: DryRunOptions): void {
    if (options.mode === 'byType' && !options.mediaType) {
      throw new BadRequestException('mediaType is required for byType mode');
    }

    if (options.mode === 'byCountry' && !options.country) {
      throw new BadRequestException('country is required for byCountry mode');
    }

    if (options.limit && (options.limit < 1 || options.limit > MAX_ITEMS)) {
      throw new BadRequestException(`limit must be between 1 and ${MAX_ITEMS}`);
    }

    if (
      options.samplePercent &&
      (options.samplePercent < MIN_SAMPLE_PERCENT || options.samplePercent > MAX_SAMPLE_PERCENT)
    ) {
      throw new BadRequestException('samplePercent must be between 1 and 100');
    }
  }

  /**
   * Fetch items based on selection mode
   */
  private async fetchItems(options: DryRunOptions, limit: number): Promise<Array<MediaItemRow>> {
    switch (options.mode) {
      case 'sample':
        return this.fetchSampleItems(limit, options.samplePercent);
      case 'top':
        return this.fetchTopItems(limit);
      case 'byType':
        return this.fetchByTypeItems(options.mediaType!, limit);
      case 'byCountry':
        return this.fetchByCountryItems(options.country!, limit);
      default:
        throw new BadRequestException(`Unknown mode: ${options.mode}`);
    }
  }

  /**
   * Fetch random sample using TABLESAMPLE (DD-6)
   */
  private async fetchSampleItems(
    limit: number,
    samplePercent?: number,
  ): Promise<Array<MediaItemRow>> {
    // Calculate sample percent based on limit and estimated table size
    // Default to 10% if not specified, adjust based on limit
    const percent =
      samplePercent ||
      Math.min(DEFAULT_SAMPLE_PERCENT, Math.max(MIN_SAMPLE_PERCENT, limit / SAMPLE_DIVISOR));

    // Use TABLESAMPLE BERNOULLI for random sampling
    // Note: TABLESAMPLE is not directly supported in Drizzle, use raw SQL
    const result = await this.db.execute(sql`
      SELECT 
        mi.id,
        mi.title,
        mi.origin_countries as "originCountries",
        mi.original_language as "originalLanguage",
        mi.content_class as "contentClass",
        mi.rating_imdb as "ratingImdb",
        mi.rating_metacritic as "ratingMetacritic",
        mi.rating_rotten_tomatoes as "ratingRottenTomatoes",
        mi.rating_trakt as "ratingTrakt",
        mi.vote_count_imdb as "voteCountImdb",
        mi.vote_count_trakt as "voteCountTrakt",
        ms.quality_score as "qualityScore",
        ms.popularity_score as "popularityScore",
        ms.freshness_score as "freshnessScore",
        ms.ratingo_score as "ratingoScore"
      FROM media_items mi TABLESAMPLE BERNOULLI(${percent})
      LEFT JOIN media_stats ms ON mi.id = ms.media_item_id
      WHERE mi.deleted_at IS NULL
        AND mi.ingestion_status = 'ready'
      LIMIT ${limit}
    `);

    return result as unknown as MediaItemRow[];
  }

  /**
   * Fetch top items by popularity/trending score
   */
  private async fetchTopItems(limit: number): Promise<Array<MediaItemRow>> {
    const result = await this.db
      .select(POLICY_EVALUATION_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(
        and(isNull(schema.mediaItems.deletedAt), eq(schema.mediaItems.ingestionStatus, 'ready')),
      )
      .orderBy(sql`${schema.mediaStats.popularityScore} DESC NULLS LAST`)
      .limit(limit);

    return result as MediaItemRow[];
  }

  /**
   * Fetch items by media type (movie/show)
   */
  private async fetchByTypeItems(
    mediaType: 'movie' | 'show',
    limit: number,
  ): Promise<Array<MediaItemRow>> {
    const typeValue = mediaType === 'movie' ? MediaType.MOVIE : MediaType.SHOW;

    const result = await this.db
      .select(POLICY_EVALUATION_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(
        and(
          isNull(schema.mediaItems.deletedAt),
          eq(schema.mediaItems.ingestionStatus, 'ready'),
          eq(schema.mediaItems.type, typeValue),
        ),
      )
      .orderBy(sql`${schema.mediaStats.popularityScore} DESC NULLS LAST`)
      .limit(limit);

    return result as MediaItemRow[];
  }

  /**
   * Fetch items by origin country
   */
  private async fetchByCountryItems(country: string, limit: number): Promise<Array<MediaItemRow>> {
    const countryUpper = country.toUpperCase();

    const result = await this.db
      .select(POLICY_EVALUATION_SELECT_FIELDS)
      .from(schema.mediaItems)
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(
        and(
          isNull(schema.mediaItems.deletedAt),
          eq(schema.mediaItems.ingestionStatus, 'ready'),
          sql`${schema.mediaItems.originCountries} @> ${JSON.stringify([countryUpper])}::jsonb`,
        ),
      )
      .orderBy(sql`${schema.mediaStats.popularityScore} DESC NULLS LAST`)
      .limit(limit);

    return result as MediaItemRow[];
  }

  /**
   * Get current evaluations for comparison
   */
  private async getCurrentEvaluations(
    mediaItemIds: string[],
  ): Promise<Map<string, { status: string }>> {
    if (mediaItemIds.length === 0) {
      return new Map();
    }

    const result = await this.db
      .select({
        mediaItemId: schema.mediaCatalogEvaluations.mediaItemId,
        status: schema.mediaCatalogEvaluations.status,
      })
      .from(schema.mediaCatalogEvaluations)
      .where(inArray(schema.mediaCatalogEvaluations.mediaItemId, mediaItemIds));

    const map = new Map<string, { status: string }>();
    for (const row of result) {
      map.set(row.mediaItemId, { status: row.status });
    }

    return map;
  }

  /**
   * Build empty result when no items found
   */
  private buildEmptyResult(mode: DryRunMode, limit: number, executionTimeMs: number): DryRunResult {
    return {
      summary: {
        totalEvaluated: 0,
        eligible: 0,
        ineligible: 0,
        review: 0,
        newlyEligible: 0,
        newlyIneligible: 0,
        unchanged: 0,
        reasonBreakdown: [],
        executionTimeMs,
        mode,
        limit,
      },
      items: [],
    };
  }
}
