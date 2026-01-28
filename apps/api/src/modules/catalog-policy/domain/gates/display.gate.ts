/**
 * Display Gate
 *
 * Context-dependent readability and overview requirements.
 * Controls what content can be displayed in different surfaces.
 */

import {
  EligibilityStatus,
  EvaluationReason,
  EvaluationContext,
  type EvaluationContextType,
} from '../constants/evaluation.constants';
import type {
  Evaluation,
  PolicyConfig,
  PolicyEngineInput,
  ContextRequirements,
} from '../types/policy.types';
import { isReadableTitle } from '../utils/title-readability';

/**
 * Default minimum overview length in characters for contexts that require overview.
 * Used when requireOverview=true and minOverviewChars is not configured.
 */
const DEFAULT_MIN_OVERVIEW_CHARS = 60;

/**
 * Result of display gate check.
 */
export interface DisplayGateResult {
  /** True if all display requirements are met */
  passes: boolean;
  /** Evaluation result if check fails, null if passes */
  evaluation: Evaluation | null;
}

/**
 * Returns default context requirements for a given context.
 *
 * Defaults:
 * - requireReadableTitle: true (all contexts)
 * - requireOverview: true (trending, homepage), false (others)
 * - minOverviewChars: 60 (when requireOverview=true)
 *
 * @param context - Evaluation context type
 * @returns Required context requirements with all fields populated
 */
export function getDefaultContextRequirements(
  context: EvaluationContextType,
): Required<ContextRequirements> {
  const requireOverview =
    context === EvaluationContext.TRENDING || context === EvaluationContext.HOMEPAGE;

  return {
    requireReadableTitle: true,
    requireOverview,
    minOverviewChars: requireOverview ? DEFAULT_MIN_OVERVIEW_CHARS : 0,
  };
}

/**
 * Merges policy context requirements with defaults.
 * Returns fully populated context requirements for the given context.
 *
 * @param policy - Policy configuration (may have partial contextRequirements)
 * @param context - Evaluation context type
 * @returns Required context requirements with all fields populated
 */
export function getContextRequirements(
  policy: PolicyConfig,
  context: EvaluationContextType,
): Required<ContextRequirements> {
  const defaults = getDefaultContextRequirements(context);
  const configured = policy.contextRequirements?.[context];

  if (!configured) {
    return defaults;
  }

  return {
    requireReadableTitle: configured.requireReadableTitle ?? defaults.requireReadableTitle,
    requireOverview: configured.requireOverview ?? defaults.requireOverview,
    minOverviewChars: configured.minOverviewChars ?? defaults.minOverviewChars,
  };
}

/**
 * Checks display gate requirements for a media item.
 * Validates readability and overview based on context.
 *
 * @param mediaItem - Media item data
 * @param policy - Policy configuration
 * @param context - Evaluation context
 * @returns Result with pass/fail and evaluation if failed
 */
export function checkDisplayGates(
  mediaItem: PolicyEngineInput['mediaItem'],
  policy: PolicyConfig,
  context: EvaluationContextType,
): DisplayGateResult {
  const contextRequirements = getContextRequirements(policy, context);

  // Check readability if requireReadableTitle=true
  if (contextRequirements.requireReadableTitle && !isReadableTitle(mediaItem.title!)) {
    return {
      passes: false,
      evaluation: {
        status: EligibilityStatus.INELIGIBLE,
        reasons: [EvaluationReason.MISSING_TRANSLATED_TITLE],
        breakoutRuleId: null,
      },
    };
  }

  // Check overview if requireOverview=true
  if (contextRequirements.requireOverview) {
    const overview = mediaItem.overview?.trim() ?? '';
    // Check for placeholders like "TBA", "N/A", "Coming soon"
    const isPlaceholder = /^(tba|n\/a|coming soon|to be announced)$/i.test(overview);
    if (
      overview.length === 0 ||
      isPlaceholder ||
      overview.length < contextRequirements.minOverviewChars
    ) {
      return {
        passes: false,
        evaluation: {
          status: EligibilityStatus.INELIGIBLE,
          reasons: [EvaluationReason.MISSING_OVERVIEW],
          breakoutRuleId: null,
        },
      };
    }
  }

  return { passes: true, evaluation: null };
}
