/**
 * Catalog Policy Engine - Domain Types
 *
 * Core type definitions for the policy engine domain.
 * These types represent the business logic layer and are independent of infrastructure.
 */

/**
 * Eligibility status for media items in the catalog
 */
export type EligibilityStatus = 'PENDING' | 'ELIGIBLE' | 'INELIGIBLE' | 'REVIEW';

/**
 * Evaluation reasons that explain why a media item has a particular eligibility status
 */
export type EvaluationReason =
  | 'MISSING_ORIGIN_COUNTRY'
  | 'MISSING_ORIGINAL_LANGUAGE'
  | 'BLOCKED_COUNTRY'
  | 'BLOCKED_LANGUAGE'
  | 'NEUTRAL_COUNTRY'
  | 'NEUTRAL_LANGUAGE'
  | 'MISSING_GLOBAL_SIGNALS'
  | 'BREAKOUT_ALLOWED'
  | 'ALLOWED_COUNTRY'
  | 'ALLOWED_LANGUAGE'
  | 'NO_ACTIVE_POLICY';

/**
 * Result of evaluating a media item against a policy
 */
export interface Evaluation {
  status: EligibilityStatus;
  reasons: EvaluationReason[];
  breakoutRuleId: string | null;
}

/**
 * Breakout rule configuration
 * Breakout rules allow content that would otherwise be blocked to become eligible
 * if it meets certain quality/popularity thresholds
 */
export interface BreakoutRule {
  id: string;
  name: string;
  priority: number; // Lower number = higher priority
  requirements: {
    minImdbVotes?: number;
    minTraktVotes?: number;
    minQualityScoreNormalized?: number; // 0-1 scale
    requireAnyOfProviders?: string[];
    requireAnyOfRatingsPresent?: ('imdb' | 'metacritic' | 'rt' | 'trakt')[];
  };
}

/**
 * Policy configuration that defines catalog eligibility rules
 */
export interface PolicyConfig {
  allowedCountries: string[];
  blockedCountries: string[];
  blockedCountryMode: 'ANY' | 'MAJORITY';
  allowedLanguages: string[];
  blockedLanguages: string[];
  globalProviders: string[];
  breakoutRules: BreakoutRule[];
  // Eligibility mode: STRICT = country AND language must be allowed
  //                   RELAXED = country OR language allowed (not recommended)
  eligibilityMode: 'STRICT' | 'RELAXED';
  homepage: {
    minRelevanceScore: number;
  };
}

/**
 * Watch providers map structure (from normalized media model)
 */
export interface WatchProvidersMap {
  [region: string]: {
    link: string | null;
    flatrate?: Array<{ providerId: number; name: string }>;
    rent?: Array<{ providerId: number; name: string }>;
    buy?: Array<{ providerId: number; name: string }>;
    ads?: Array<{ providerId: number; name: string }>;
    free?: Array<{ providerId: number; name: string }>;
  };
}

/**
 * Input data for policy engine evaluation
 * Contains all necessary information to evaluate a media item
 */
export interface PolicyEngineInput {
  mediaItem: {
    id: string;
    originCountries: string[] | null;
    originalLanguage: string | null;
    watchProviders: WatchProvidersMap | null;
    voteCountImdb: number | null;
    voteCountTrakt: number | null;
    ratingImdb: number | null;
    ratingMetacritic: number | null;
    ratingRottenTomatoes: number | null;
    ratingTrakt: number | null;
  };
  stats: {
    qualityScore: number | null;
    popularityScore: number | null;
    freshnessScore: number | null;
    ratingoScore: number | null;
  } | null;
}

/**
 * Catalog policy entity (database model)
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
 * Media catalog evaluation entity (database model)
 */
export interface MediaCatalogEvaluation {
  mediaItemId: string;
  status: EligibilityStatus;
  reasons: string[];
  relevanceScore: number;
  policyVersion: number;
  breakoutRuleId: string | null;
  evaluatedAt: Date;
}

/**
 * Catalog evaluation run entity (database model)
 *
 * Status lifecycle: RUNNING → PREPARED → PROMOTED | CANCELLED | FAILED
 * - RUNNING: Evaluation in progress
 * - PREPARED: Evaluation complete, ready for promotion
 * - PROMOTED: Policy activated, terminal state
 * - CANCELLED: User cancelled, terminal state
 * - FAILED: Error occurred, terminal state
 */
export interface CatalogEvaluationRun {
  id: string;
  policyVersion: number;
  status: 'RUNNING' | 'PREPARED' | 'FAILED' | 'CANCELLED' | 'PROMOTED';
  startedAt: Date;
  finishedAt: Date | null;
  cursor: string | null;
  counters: {
    processed: number;
    eligible: number;
    ineligible: number;
    review: number;
    reasonBreakdown: Record<string, number>;
  };
}
