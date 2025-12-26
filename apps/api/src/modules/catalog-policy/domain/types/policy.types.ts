/**
 * Catalog Policy Engine - Domain Types
 *
 * Core type definitions for policy configuration and evaluation results.
 */

import { EligibilityStatusType } from '../constants/evaluation.constants';

/**
 * Evaluation reason codes.
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
 * Result of evaluating a media item against a policy.
 */
export interface Evaluation {
  status: EligibilityStatusType;
  reasons: EvaluationReason[];
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
 * Valid rating source identifiers.
 */
export type RatingSource = 'imdb' | 'metacritic' | 'rt' | 'trakt';

/**
 * Global quality gate requirements.
 * All configured conditions are combined with AND logic.
 */
export interface GlobalRequirements {
  /** Minimum IMDb votes required. Missing votes = fail. */
  minImdbVotes?: number;

  /** Minimum Trakt votes required. Missing votes = fail. */
  minTraktVotes?: number;

  /** Minimum quality score normalized (0-1). Missing score = fail. */
  minQualityScoreNormalized?: number;

  /** At least one of these rating sources must be present (non-null, valid number). */
  requireAnyOfRatingsPresent?: RatingSource[];
}

/**
 * Diagnostic details for global gate failures.
 */
export interface GlobalGateDetails {
  /** List of checks that failed */
  failedChecks: (
    | 'minImdbVotes'
    | 'minTraktVotes'
    | 'minQualityScoreNormalized'
    | 'requireAnyOfRatingsPresent'
  )[];
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
  requirements: {
    minImdbVotes?: number;
    minTraktVotes?: number;
    minQualityScoreNormalized?: number;
    requireAnyOfProviders?: string[];
    requireAnyOfRatingsPresent?: RatingSource[];
  };
}

/**
 * Policy configuration defining catalog eligibility rules.
 */
export interface PolicyConfig {
  allowedCountries: string[];
  blockedCountries: string[];
  blockedCountryMode: 'ANY' | 'MAJORITY';
  allowedLanguages: string[];
  blockedLanguages: string[];
  globalProviders: string[];
  breakoutRules: BreakoutRule[];
  /**
   * Eligibility mode.
   * STRICT = country AND language must be allowed.
   * RELAXED = country OR language must be allowed.
   */
  eligibilityMode: 'STRICT' | 'RELAXED';
  homepage: {
    minRelevanceScore: number;
  };
  /**
   * Optional global quality gate. If not set, gate is skipped.
   */
  globalRequirements?: GlobalRequirements;
}

/**
 * Watch providers map structure.
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
 * Input data for policy engine evaluation.
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
  evaluatedAt: Date;
  /**
   * Links evaluation to specific run.
   * NULL for legacy/manual evaluations.
   */
  runId?: string;
}

/**
 * Catalog evaluation run entity (database model).
 *
 * Lifecycle: RUNNING → PREPARED → PROMOTED | CANCELLED | FAILED
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
