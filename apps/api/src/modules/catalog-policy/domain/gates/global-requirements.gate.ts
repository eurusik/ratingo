/**
 * Global Requirements Gate
 *
 * Quality gate based on ratings, votes, and quality scores.
 * All configured conditions are combined with AND logic.
 */

import { EvaluationContext, type EvaluationContextType } from '../constants/evaluation.constants';
import {
  RatingSource,
  VoteSource,
  GlobalGateCheck,
  type GlobalRequirements,
  type PolicyEngineInput,
  type GlobalGateCheckType,
} from '../types/policy.types';

/**
 * Default contexts where gate applies when appliesTo not configured.
 * Quality-driven surfaces that require maturity signals.
 */
const DEFAULT_QUALITY_CONTEXTS: EvaluationContextType[] = [
  EvaluationContext.CATALOG,
  EvaluationContext.HOMEPAGE,
  EvaluationContext.TRENDING,
  EvaluationContext.SEARCH,
];

/** @deprecated Use GlobalGateCheckType from policy.types instead */
export type GlobalGateFailedCheck = GlobalGateCheckType;

/**
 * Result of global requirements check.
 */
export interface GlobalRequirementsResult {
  /** True if all requirements are met */
  passes: boolean;
  /** List of checks that failed */
  failedChecks: GlobalGateCheckType[];
}

/**
 * Determines if global gate should be applied for given context.
 *
 * @param requirements - Global requirements configuration
 * @param context - Evaluation context (defaults to 'catalog')
 * @returns True if gate should be applied
 */
export function shouldApplyGlobalGate(
  requirements: GlobalRequirements | undefined,
  context: EvaluationContextType = EvaluationContext.CATALOG,
): boolean {
  if (!requirements) return false;
  const appliesTo = requirements.appliesTo ?? DEFAULT_QUALITY_CONTEXTS;
  return appliesTo.includes(context);
}

/**
 * Checks if media has any of the required ratings.
 * A rating is valid if it's non-null and not NaN.
 *
 * @param mediaItem - Media item data
 * @param requiredRatings - List of required rating sources
 * @returns True if any required rating is present
 */
export function hasAnyRating(
  mediaItem: PolicyEngineInput['mediaItem'],
  requiredRatings: RatingSource[],
): boolean {
  for (const rating of requiredRatings) {
    let value: number | null = null;
    switch (rating) {
      case RatingSource.IMDB:
        value = mediaItem.ratingImdb;
        break;
      case RatingSource.METACRITIC:
        value = mediaItem.ratingMetacritic;
        break;
      case RatingSource.RT:
        value = mediaItem.ratingRottenTomatoes;
        break;
      case RatingSource.TRAKT:
        value = mediaItem.ratingTrakt;
        break;
    }
    // Check for non-null and non-NaN values
    if (value !== null && !Number.isNaN(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if media meets global quality requirements.
 * All configured conditions are combined with AND logic.
 *
 * @param input - Media item data and stats
 * @param requirements - Global requirements configuration
 * @returns Object with pass/fail status and failed checks
 */
export function checkGlobalRequirements(
  input: PolicyEngineInput,
  requirements: GlobalRequirements | undefined,
): GlobalRequirementsResult {
  if (!requirements) {
    return { passes: true, failedChecks: [] };
  }

  const failedChecks: GlobalGateCheckType[] = [];
  const { mediaItem } = input;

  // Check minQualityScoreNormalized (null/undefined = fail)
  if (requirements.minQualityScoreNormalized !== undefined) {
    const qualityScore = input.stats?.qualityScore;
    if (
      qualityScore === null ||
      qualityScore === undefined ||
      qualityScore < requirements.minQualityScoreNormalized
    ) {
      failedChecks.push(GlobalGateCheck.MIN_QUALITY_SCORE);
    }
  }

  // Check requireAnyOfRatingsPresent (OR logic)
  if (
    requirements.requireAnyOfRatingsPresent &&
    requirements.requireAnyOfRatingsPresent.length > 0
  ) {
    if (!hasAnyRating(mediaItem, requirements.requireAnyOfRatingsPresent)) {
      failedChecks.push(GlobalGateCheck.REQUIRE_RATINGS);
    }
  }

  // Check minVotesAnyOf (OR logic - passes if ANY source meets threshold)
  if (requirements.minVotesAnyOf) {
    const { sources, min } = requirements.minVotesAnyOf;
    const hasEnoughVotes = sources.some((source) => {
      const votes = source === VoteSource.IMDB ? mediaItem.voteCountImdb : mediaItem.voteCountTrakt;
      return votes !== null && votes !== undefined && votes >= min;
    });
    if (!hasEnoughVotes) {
      failedChecks.push(GlobalGateCheck.MIN_VOTES);
    }
  }

  return {
    passes: failedChecks.length === 0,
    failedChecks,
  };
}
