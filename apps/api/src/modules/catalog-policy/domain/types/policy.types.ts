/**
 * Catalog Policy Engine - Domain Types
 *
 * Core type definitions for policy configuration and evaluation results.
 */

import { type ContentClass } from '../classification.service';
import {
  type EligibilityStatusType,
  type EvaluationReasonType,
  type EvaluationContextType,
} from '../constants/evaluation.constants';

/**
 * Evaluation context for content display surfaces.
 * Controls context-aware gate application.
 * @deprecated Use EvaluationContextType from constants instead
 */
export type EvaluationContext = EvaluationContextType;

/**
 * Options for policy evaluation.
 */
export interface EvaluationOptions {
  /** Context where content will be displayed. Defaults to 'catalog' (legacy/batch mode). */
  context?: EvaluationContext;
}

/**
 * Result of evaluating a media item against a policy.
 */
export interface Evaluation {
  status: EligibilityStatusType;
  reasons: EvaluationReasonType[];
  breakoutRuleId: string | null;
  /**
   * Diagnostic details when global gate check was performed.
   * Present ONLY when:
   * - status = INELIGIBLE AND reasons includes MISSING_GLOBAL_SIGNALS, OR
   * - status = INELIGIBLE AND content is blocked but gate also failed
   * Otherwise undefined.
   */
  globalGateDetails?: GlobalGateDetails;
}

/**
 * Rating source constants.
 */
export const RatingSource = {
  IMDB: 'imdb',
  METACRITIC: 'metacritic',
  RT: 'rt',
  TRAKT: 'trakt',
} as const;

/**
 * Rating source type.
 */
export type RatingSource = (typeof RatingSource)[keyof typeof RatingSource];

/**
 * Vote source constants.
 */
export const VoteSource = {
  IMDB: 'imdb',
  TRAKT: 'trakt',
} as const;

/**
 * Vote source type.
 */
export type VoteSource = (typeof VoteSource)[keyof typeof VoteSource];

/**
 * Global gate failed check constants.
 */
export const GlobalGateCheck = {
  MIN_QUALITY_SCORE: 'minQualityScoreNormalized',
  REQUIRE_RATINGS: 'requireAnyOfRatingsPresent',
  MIN_VOTES: 'minVotesAnyOf',
  LOCAL_MATURITY_OVERRIDE: 'localMaturityOverride',
} as const;

/**
 * Global gate failed check type.
 */
export type GlobalGateCheckType = (typeof GlobalGateCheck)[keyof typeof GlobalGateCheck];

/**
 * Local maturity override configuration.
 * Alternative path for fresh content with strong local platform engagement.
 *
 * When minVotesAnyOf fails, content can still pass if:
 * - Freshness score meets threshold (indicating new release)
 * - Local watchers count meets threshold (indicating platform engagement)
 *
 * This allows new releases that users are watching to appear in trending
 * before they accumulate external votes from IMDb/Trakt.
 */
export interface LocalMaturityOverride {
  /**
   * Minimum freshness score normalized (0-1).
   * Higher values = stricter freshness requirement.
   * Example: 0.90 = must be in top 10% freshest content.
   */
  minFreshnessScoreNormalized: number;

  /**
   * Minimum Ratingo platform watchers count.
   * Validates local engagement signal.
   * Example: 30 = at least 30 users actively watching on platform.
   */
  minLocalWatchers: number;
}

/**
 * Global quality gate requirements.
 * All configured conditions are combined with AND logic.
 */
export interface GlobalRequirements {
  /** Minimum quality score normalized (0-1). Missing score = fail. */
  minQualityScoreNormalized?: number;

  /**
   * At least one of these rating sources must be present.
   * OR logic - passes if ANY source has a rating.
   */
  requireAnyOfRatingsPresent?: RatingSource[];

  /**
   * Minimum votes from ANY of the specified sources.
   * OR logic - passes if ANY source meets the threshold.
   *
   * @example { sources: ['imdb', 'trakt'], min: 3000 }
   */
  minVotesAnyOf?: {
    sources: VoteSource[];
    min: number;
  };

  /**
   * Contexts where global gate applies.
   * Defaults to ['catalog', 'homepage', 'trending', 'search'].
   */
  appliesTo?: EvaluationContext[];

  /**
   * Alternative path for fresh content with local engagement.
   * Applied only when minVotesAnyOf check fails.
   * Allows new releases with strong platform signals to bypass vote requirements.
   */
  localMaturityOverride?: LocalMaturityOverride;
}

/**
 * Diagnostic details for global gate failures.
 */
export interface GlobalGateDetails {
  /** List of checks that failed */
  failedChecks: GlobalGateCheckType[];
}

/**
 * Availability mode constants for provider filtering.
 */
export const AvailabilityMode = {
  SUBSCRIPTION_ONLY: 'subscription_only',
  TRANSACTIONAL_ONLY: 'transactional_only',
  ANY: 'any',
} as const;

/**
 * Availability mode type for provider filtering.
 */
export type AvailabilityMode = (typeof AvailabilityMode)[keyof typeof AvailabilityMode];

/**
 * Eligibility mode constants.
 */
export const EligibilityMode = {
  /** Country AND language must be allowed */
  STRICT: 'STRICT',
  /** Country OR language must be allowed */
  RELAXED: 'RELAXED',
} as const;

/**
 * Eligibility mode type.
 */
export type EligibilityModeType = (typeof EligibilityMode)[keyof typeof EligibilityMode];

/**
 * Blocked country mode constants.
 */
export const BlockedCountryMode = {
  /** Any blocked country = blocked */
  ANY: 'ANY',
  /** Majority of countries must be blocked */
  MAJORITY: 'MAJORITY',
} as const;

/**
 * Blocked country mode type.
 */
export type BlockedCountryModeType = (typeof BlockedCountryMode)[keyof typeof BlockedCountryMode];

/**
 * Breakout rule requirements for provider filtering.
 */
export interface BreakoutProviderRequirements {
  /** Canonical provider IDs - at least one must be present */
  requireAnyOfProviders?: string[];
  /** Filter by availability mode. Defaults to 'subscription_only'. */
  availabilityMode?: AvailabilityMode;
  /** Exclude ads-tier variants (requires variant lookup). Defaults to false. */
  excludeAdsTiers?: boolean;
  /** Exclude non-direct distribution channels. Defaults to false. */
  excludeChannelDistribution?: boolean;
}

/**
 * Breakout rule configuration.
 * Allows blocked content to become eligible under specific conditions.
 */
export interface BreakoutRule {
  id: string;
  name: string;
  /**
   * Priority of the rule.
   * Lower number = higher priority.
   */
  priority: number;
  requirements: BreakoutProviderRequirements & {
    minImdbVotes?: number;
    minTraktVotes?: number;
    minQualityScoreNormalized?: number;
    requireAnyOfRatingsPresent?: RatingSource[];
    /**
     * Origin countries filter (ISO 3166-1 alpha-2 codes).
     * Rule matches if media has ANY of these countries (intersection).
     */
    originCountries?: string[];
    /**
     * Excluded origin countries (ISO 3166-1 alpha-2 codes).
     * Rule does NOT match if media has ANY of these countries.
     * Used to prevent breakout for specific blocked countries.
     */
    excludeOriginCountries?: string[];
  };
}

/**
 * Context-specific display requirements.
 * Controls readability and overview gates per display surface.
 */
export interface ContextRequirements {
  /**
   * Require readable title (Latin/Cyrillic presence).
   * Default: true (all contexts)
   */
  requireReadableTitle?: boolean;
  /**
   * Require overview presence.
   * Default: false (true for trending/homepage)
   */
  requireOverview?: boolean;
  /**
   * Minimum overview length in characters.
   * Only evaluated if requireOverview=true.
   * Default: 60 when requireOverview=true
   */
  minOverviewChars?: number;
}

/**
 * Policy configuration defining catalog eligibility rules.
 */
export interface PolicyConfig {
  allowedCountries: string[];
  blockedCountries: string[];
  blockedCountryMode: BlockedCountryModeType;
  allowedLanguages: string[];
  blockedLanguages: string[];
  globalProviders: string[];
  breakoutRules: BreakoutRule[];
  /** Eligibility mode - STRICT (AND) or RELAXED (OR) for country/language. */
  eligibilityMode: EligibilityModeType;
  homepage: {
    minRelevanceScore: number;
  };
  /**
   * Optional global quality gate. If not set, gate is skipped.
   */
  globalRequirements?: GlobalRequirements;
  /**
   * Content classes to exclude from catalog.
   * SOFT filter: breakout rules CAN override this exclusion.
   * Example: ['anime', 'reality'] excludes anime and reality content unless breakout passes.
   */
  excludedContentClasses?: ContentClass[];
  /**
   * Context-specific requirements for display surfaces.
   * Keys are EvaluationContextType values.
   * Missing contexts use defaults from getDefaultContextRequirements().
   */
  contextRequirements?: Partial<Record<EvaluationContextType, ContextRequirements>>;
}

/**
 * Offer type constants for normalized watch offers.
 */
export const OfferType = {
  FLATRATE: 'flatrate',
  RENT: 'rent',
  BUY: 'buy',
  ADS: 'ads',
  FREE: 'free',
} as const;

/**
 * Offer type for normalized watch offers.
 */
export type NormalizedOfferType = (typeof OfferType)[keyof typeof OfferType];

/**
 * Distribution channel constants.
 */
export const DistributionChannel = {
  DIRECT: 'direct',
  AMAZON_CHANNEL: 'amazon_channel',
  APPLE_TV_CHANNEL: 'apple_tv_channel',
} as const;

/**
 * Distribution channel type.
 */
export type DistributionChannelType =
  (typeof DistributionChannel)[keyof typeof DistributionChannel];

/**
 * Normalized watch offer for policy evaluation.
 * Pre-resolved to canonical provider IDs.
 */
export interface NormalizedOffer {
  /** Canonical provider ID (e.g., 'netflix', 'disney_plus') */
  providerId: string;
  /** Offer type */
  offerType: NormalizedOfferType;
  /** Distribution channel */
  distributionChannel: DistributionChannelType;
  /** Whether this is an ads-supported tier (for excludeAdsTiers filtering) */
  isAdsTier?: boolean;
}

/**
 * Input data for policy engine evaluation.
 */
export interface PolicyEngineInput {
  mediaItem: {
    id: string;
    originCountries: string[] | null;
    originalLanguage: string | null;
    /**
     * Normalized watch offers with canonical provider IDs.
     * Pre-resolved from media_watch_offers table.
     */
    normalizedOffers: NormalizedOffer[];
    voteCountImdb: number | null;
    voteCountTrakt: number | null;
    ratingImdb: number | null;
    ratingMetacritic: number | null;
    ratingRottenTomatoes: number | null;
    ratingTrakt: number | null;
    /**
     * Content classification for filtering.
     * Validated in application layer before engine evaluation.
     */
    contentClass: ContentClass;
    /**
     * Display title from media_items.
     * Used for readability checks (Latin/Cyrillic presence for UA audience).
     */
    title: string | null;
    /**
     * Description from media_items.
     * Used for context-dependent overview requirements (trending/homepage).
     */
    overview: string | null;
  };
  stats: {
    qualityScore: number | null;
    popularityScore: number | null;
    freshnessScore: number | null;
    ratingoScore: number | null;
    /**
     * Current live watchers count from Ratingo platform.
     * Used for localMaturityOverride gate checks.
     */
    watchersCount?: number | null;
  } | null;
}

/**
 * Catalog policy entity (database model).
 */
export interface CatalogPolicy {
  id: string;
  version: number;
  isActive: boolean;
  policy: PolicyConfig;
  createdAt: Date;
  activatedAt: Date | null;
}

/**
 * Media catalog evaluation entity (database model).
 */
export interface MediaCatalogEvaluation {
  mediaItemId: string;
  status: EligibilityStatusType;
  reasons: string[];
  relevanceScore: number;
  policyVersion: number;
  breakoutRuleId: string | null;
  evaluatedAt: Date | null;
  /**
   * Links evaluation to specific run.
   * NULL for legacy/manual evaluations.
   */
  runId?: string;
  /**
   * Display surface context for this evaluation.
   * Defaults to 'catalog' for backward compatibility.
   */
  context: EvaluationContext;
}

/**
 * Catalog evaluation run entity (database model).
 *
 * Lifecycle: running → prepared → promoted | cancelled | failed
 *
 * Note: Repository layer (infrastructure) extends this with additional fields.
 * This is the domain-level representation.
 *
 * Per Readability & Pending Reform: pending is always 0 for new runs.
 * PENDING is no longer returned by Policy Engine.
 */
export interface CatalogEvaluationRun {
  id: string;
  policyVersion: number;
  status: 'running' | 'prepared' | 'failed' | 'cancelled' | 'promoted';
  startedAt: Date;
  finishedAt: Date | null;
  cursor: string | null;
  processed: number;
  eligible: number;
  ineligible: number;
  errors: number;
}
