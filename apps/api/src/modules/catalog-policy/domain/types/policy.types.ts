/**
 * Catalog Policy Engine - Domain Types
 */

import { EligibilityStatusType } from '../constants/evaluation.constants';

/** Evaluation reason codes. */
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

/** Result of evaluating a media item against a policy. */
export interface Evaluation {
  status: EligibilityStatusType;
  reasons: EvaluationReason[];
  breakoutRuleId: string | null;
}

/** Breakout rule configuration. Allows blocked content to become eligible. */
export interface BreakoutRule {
  id: string;
  name: string;
  /** Lower number = higher priority */
  priority: number;
  requirements: {
    minImdbVotes?: number;
    minTraktVotes?: number;
    minQualityScoreNormalized?: number;
    requireAnyOfProviders?: string[];
    requireAnyOfRatingsPresent?: ('imdb' | 'metacritic' | 'rt' | 'trakt')[];
  };
}

/** Policy configuration defining catalog eligibility rules. */
export interface PolicyConfig {
  allowedCountries: string[];
  blockedCountries: string[];
  blockedCountryMode: 'ANY' | 'MAJORITY';
  allowedLanguages: string[];
  blockedLanguages: string[];
  globalProviders: string[];
  breakoutRules: BreakoutRule[];
  /** STRICT = country AND language must be allowed. */
  eligibilityMode: 'STRICT' | 'RELAXED';
  homepage: {
    minRelevanceScore: number;
  };
}

/** Watch providers map structure. */
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

/** Input data for policy engine evaluation. */
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

/** Catalog policy entity (database model). */
export interface CatalogPolicy {
  id: string;
  version: number;
  isActive: boolean;
  policy: PolicyConfig;
  createdAt: Date;
  activatedAt: Date | null;
}

/** Media catalog evaluation entity (database model). */
export interface MediaCatalogEvaluation {
  mediaItemId: string;
  status: EligibilityStatusType;
  reasons: string[];
  relevanceScore: number;
  policyVersion: number;
  breakoutRuleId: string | null;
  evaluatedAt: Date;
  /** Links evaluation to specific run. NULL for legacy/manual evaluations. */
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
