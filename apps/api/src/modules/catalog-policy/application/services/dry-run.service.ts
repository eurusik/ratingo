/**
 * Dry-Run Service
 *
 * Evaluates media items against a proposed policy WITHOUT persisting results.
 * Modes: sample, top, byType, byCountry. Max 10000 items, 60s timeout.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';

import { MediaType } from '../../../../common/enums/media-type.enum';
import {
  type IMediaWatchOffersRepository,
  MEDIA_WATCH_OFFERS_REPOSITORY,
  type MediaWatchOfferView,
} from '../../../provider/public';
import {
  EligibilityStatus,
  type EligibilityStatusType,
  type EvaluationReasonType,
} from '../../domain/constants/evaluation.constants';
import {
  MissingModeParameterError,
  InvalidLimitError,
  InvalidSamplePercentError,
  UnknownDryRunModeError,
} from '../../domain/errors';
import { evaluateEligibility, computeRelevance } from '../../domain/policy-engine';
import {
  DRY_RUN_REPOSITORY,
  type IDryRunRepository,
  type DryRunMediaItem,
  type CurrentEvaluation,
} from '../../domain/repositories';
import { type DryRunMode } from '../../domain/types/dry-run.types';
import { type PolicyConfig } from '../../domain/types/policy.types';
import { mapOffersToNormalized } from '../utils/offer-mapper';
import { mapRowToPolicyEngineInput } from '../utils/policy-input.mapper';

import { CatalogPolicyService } from './catalog-policy.service';

export type { DryRunMode } from '../../domain/types/dry-run.types';

export interface DryRunOptions {
  mode: DryRunMode;
  limit?: number;
  mediaType?: 'movie' | 'show';
  country?: string;
  samplePercent?: number;
}

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

export interface ReasonBreakdown {
  reason: EvaluationReasonType;
  count: number;
}

export interface DryRunSummary {
  totalEvaluated: number;
  eligible: number;
  ineligible: number;
  review: number;
  newlyEligible: number;
  newlyIneligible: number;
  unchanged: number;
  newItems: number;
  reasonBreakdown: ReasonBreakdown[];
  executionTimeMs: number;
  mode: DryRunMode;
  limit: number;
  timedOut: boolean;
}

export interface DryRunResult {
  summary: DryRunSummary;
  items: DryRunItemResult[];
}

interface EvaluationCounters {
  eligible: number;
  ineligible: number;
  review: number;
  newlyEligible: number;
  newlyIneligible: number;
  unchanged: number;
  newItems: number;
  reasonCounts: Record<string, number>;
}

interface EvaluationContext {
  items: DryRunMediaItem[];
  policy: PolicyConfig;
  currentEvaluations: Map<string, CurrentEvaluation>;
  offersMap: Map<string, MediaWatchOfferView[]>;
  startTime: number;
}

interface EvaluationLoopResult {
  results: DryRunItemResult[];
  counters: EvaluationCounters;
  timedOut: boolean;
}

const MAX_ITEMS = 10000;
const DEFAULT_LIMIT = 1000;
const MAX_SAMPLE_PERCENT = 100;
const DEFAULT_SAMPLE_PERCENT = 10;
const MIN_SAMPLE_PERCENT = 1;
const TIMEOUT_MS = parseInt(process.env.DRY_RUN_TIMEOUT_MS || '60000', 10);

@Injectable()
export class DryRunService {
  private readonly logger = new Logger(DryRunService.name);

  constructor(
    @Inject(DRY_RUN_REPOSITORY)
    private readonly dryRunRepository: IDryRunRepository,
    private readonly policyService: CatalogPolicyService,
    @Inject(MEDIA_WATCH_OFFERS_REPOSITORY)
    private readonly watchOffersRepository: IMediaWatchOffersRepository,
  ) {}

  async execute(proposedPolicy: PolicyConfig, options: DryRunOptions): Promise<DryRunResult> {
    const startTime = Date.now();
    const limit = Math.min(options.limit || DEFAULT_LIMIT, MAX_ITEMS);

    this.logger.log(`Starting dry-run: mode=${options.mode}, limit=${limit}`);
    this.validateOptions(options);

    const items = await this.fetchItems(options, limit);
    if (items.length === 0) {
      return this.buildEmptyResult(options.mode, limit, Date.now() - startTime);
    }

    const context = await this.prepareEvaluationContext(items, proposedPolicy, startTime);
    const { results, counters, timedOut } = this.evaluateItems(context);
    const executionTimeMs = Date.now() - startTime;

    this.logger.log(
      `Dry-run complete: ${results.length} items in ${executionTimeMs}ms. ` +
        `Eligible: ${counters.eligible}, Ineligible: ${counters.ineligible}`,
    );

    return this.buildResult(results, counters, timedOut, options.mode, limit, executionTimeMs);
  }

  async executeDiff(
    proposedPolicy: PolicyConfig,
    options: DryRunOptions,
  ): Promise<DryRunResult & { currentPolicyVersion: number | null }> {
    const activePolicy = await this.policyService.getActive();
    const result = await this.execute(proposedPolicy, options);
    return { ...result, currentPolicyVersion: activePolicy?.version || null };
  }

  private validateOptions(options: DryRunOptions): void {
    if (options.mode === 'byType' && !options.mediaType) {
      throw new MissingModeParameterError('byType', 'mediaType');
    }
    if (options.mode === 'byCountry' && !options.country) {
      throw new MissingModeParameterError('byCountry', 'country');
    }
    if (options.limit && (options.limit < 1 || options.limit > MAX_ITEMS)) {
      throw new InvalidLimitError(options.limit, 1, MAX_ITEMS);
    }
    if (
      options.samplePercent &&
      (options.samplePercent < MIN_SAMPLE_PERCENT || options.samplePercent > MAX_SAMPLE_PERCENT)
    ) {
      throw new InvalidSamplePercentError(
        options.samplePercent,
        MIN_SAMPLE_PERCENT,
        MAX_SAMPLE_PERCENT,
      );
    }
  }

  private async fetchItems(options: DryRunOptions, limit: number): Promise<DryRunMediaItem[]> {
    switch (options.mode) {
      case 'sample':
        return this.dryRunRepository.fetchSampleItems(
          limit,
          options.samplePercent ?? DEFAULT_SAMPLE_PERCENT,
        );
      case 'top':
        return this.dryRunRepository.fetchTopItems(limit);
      case 'byType':
        return this.dryRunRepository.fetchByTypeItems(
          options.mediaType === 'movie' ? MediaType.MOVIE : MediaType.SHOW,
          limit,
        );
      case 'byCountry':
        return this.dryRunRepository.fetchByCountryItems(options.country!, limit);
      default:
        throw new UnknownDryRunModeError(options.mode as string);
    }
  }

  private async prepareEvaluationContext(
    items: DryRunMediaItem[],
    policy: PolicyConfig,
    startTime: number,
  ): Promise<EvaluationContext> {
    const mediaItemIds = items.map((i) => i.id);
    const [currentEvaluations, offersMap] = await Promise.all([
      this.dryRunRepository.getCurrentEvaluations(mediaItemIds),
      this.watchOffersRepository.getOffersForMediaBatch(mediaItemIds, { includeVariantInfo: true }),
    ]);
    return { items, policy, currentEvaluations, offersMap, startTime };
  }

  private evaluateItems(ctx: EvaluationContext): EvaluationLoopResult {
    const results: DryRunItemResult[] = [];
    const counters = this.createEmptyCounters();
    let timedOut = false;

    for (const item of ctx.items) {
      if (this.isTimedOut(ctx.startTime)) {
        this.logger.warn(`Dry-run timeout reached after ${results.length} items`);
        timedOut = true;
        break;
      }

      const result = this.evaluateSingleItem(item, ctx, counters);
      results.push(result);
    }

    return { results, counters, timedOut };
  }

  private evaluateSingleItem(
    item: DryRunMediaItem,
    ctx: EvaluationContext,
    counters: EvaluationCounters,
  ): DryRunItemResult {
    const normalizedOffers = mapOffersToNormalized(ctx.offersMap.get(item.id) ?? []);
    const input = mapRowToPolicyEngineInput(item, normalizedOffers, this.logger);
    const evalResult = evaluateEligibility(input, ctx.policy);
    const relevanceScore = computeRelevance(input, ctx.policy);

    const currentEval = ctx.currentEvaluations.get(item.id);
    const currentStatus = currentEval?.status || null;
    const isNewItem = currentStatus === null;
    const statusChanged = currentStatus !== evalResult.status;

    this.updateCounters(counters, evalResult.status, currentStatus, isNewItem, statusChanged);
    this.countReasons(counters, evalResult.reasons);

    return {
      mediaItemId: item.id,
      title: item.title ?? '',
      currentStatus: currentStatus as EligibilityStatusType | null,
      proposedStatus: evalResult.status,
      reasons: evalResult.reasons,
      relevanceScore,
      breakoutRuleId: evalResult.breakoutRuleId,
      statusChanged,
    };
  }

  private updateCounters(
    counters: EvaluationCounters,
    newStatus: EligibilityStatusType,
    currentStatus: string | null,
    isNewItem: boolean,
    statusChanged: boolean,
  ): void {
    if (isNewItem) counters.newItems++;

    switch (newStatus) {
      case EligibilityStatus.ELIGIBLE:
        counters.eligible++;
        if (!isNewItem && currentStatus !== EligibilityStatus.ELIGIBLE) counters.newlyEligible++;
        break;
      case EligibilityStatus.INELIGIBLE:
        counters.ineligible++;
        if (!isNewItem && currentStatus !== EligibilityStatus.INELIGIBLE)
          counters.newlyIneligible++;
        break;
      case EligibilityStatus.REVIEW:
        counters.review++;
        break;
    }

    if (!statusChanged && !isNewItem) counters.unchanged++;
  }

  private countReasons(counters: EvaluationCounters, reasons: EvaluationReasonType[]): void {
    for (const reason of reasons) {
      counters.reasonCounts[reason] = (counters.reasonCounts[reason] || 0) + 1;
    }
  }

  private buildResult(
    results: DryRunItemResult[],
    counters: EvaluationCounters,
    timedOut: boolean,
    mode: DryRunMode,
    limit: number,
    executionTimeMs: number,
  ): DryRunResult {
    return {
      summary: {
        totalEvaluated: results.length,
        eligible: counters.eligible,
        ineligible: counters.ineligible,
        review: counters.review,
        newlyEligible: counters.newlyEligible,
        newlyIneligible: counters.newlyIneligible,
        unchanged: counters.unchanged,
        newItems: counters.newItems,
        reasonBreakdown: this.buildReasonBreakdown(counters.reasonCounts),
        executionTimeMs,
        mode,
        limit,
        timedOut,
      },
      items: results,
    };
  }

  private buildReasonBreakdown(reasonCounts: Record<string, number>): ReasonBreakdown[] {
    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason: reason as EvaluationReasonType, count }))
      .sort((a, b) => b.count - a.count);
  }

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
        newItems: 0,
        reasonBreakdown: [],
        executionTimeMs,
        mode,
        limit,
        timedOut: false,
      },
      items: [],
    };
  }

  private createEmptyCounters(): EvaluationCounters {
    return {
      eligible: 0,
      ineligible: 0,
      review: 0,
      newlyEligible: 0,
      newlyIneligible: 0,
      unchanged: 0,
      newItems: 0,
      reasonCounts: {},
    };
  }

  private isTimedOut(startTime: number): boolean {
    return Date.now() - startTime > TIMEOUT_MS;
  }
}
