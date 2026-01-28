/**
 * Data Integrity Gate
 *
 * Validates required metadata presence for policy evaluation.
 * Missing critical metadata results in immediate INELIGIBLE status.
 */

import {
  EligibilityStatus,
  EvaluationReason,
  type EvaluationReasonType,
} from '../constants/evaluation.constants';
import type { Evaluation, PolicyEngineInput } from '../types/policy.types';

/**
 * Result of data integrity check.
 */
export interface DataIntegrityResult {
  /** True if all required data is present */
  passes: boolean;
  /** Evaluation result if check fails, null if passes */
  evaluation: Evaluation | null;
}

/**
 * Checks data integrity for policy evaluation.
 * Validates: origin countries, original language, title.
 *
 * Order of checks matters for specific reason reporting:
 * 1. Origin countries
 * 2. Original language
 * 3. Title
 *
 * @param mediaItem - Media item data
 * @returns Result with pass/fail and evaluation if failed
 */
export function checkDataIntegrity(mediaItem: PolicyEngineInput['mediaItem']): DataIntegrityResult {
  const reasons: EvaluationReasonType[] = [];

  // Check origin countries
  if (!mediaItem.originCountries || mediaItem.originCountries.length === 0) {
    reasons.push(EvaluationReason.MISSING_REQUIRED_METADATA);
    reasons.push(EvaluationReason.MISSING_ORIGIN_COUNTRY);
    return {
      passes: false,
      evaluation: {
        status: EligibilityStatus.INELIGIBLE,
        reasons,
        breakoutRuleId: null,
      },
    };
  }

  // Check original language (null, undefined, or empty string treated as missing)
  if (!mediaItem.originalLanguage || mediaItem.originalLanguage.trim().length === 0) {
    reasons.push(EvaluationReason.MISSING_REQUIRED_METADATA);
    reasons.push(EvaluationReason.MISSING_ORIGINAL_LANGUAGE);
    return {
      passes: false,
      evaluation: {
        status: EligibilityStatus.INELIGIBLE,
        reasons,
        breakoutRuleId: null,
      },
    };
  }

  // Check title is not null/empty
  if (!mediaItem.title || mediaItem.title.trim().length === 0) {
    reasons.push(EvaluationReason.MISSING_REQUIRED_METADATA);
    reasons.push(EvaluationReason.MISSING_TITLE);
    return {
      passes: false,
      evaluation: {
        status: EligibilityStatus.INELIGIBLE,
        reasons,
        breakoutRuleId: null,
      },
    };
  }

  return { passes: true, evaluation: null };
}
