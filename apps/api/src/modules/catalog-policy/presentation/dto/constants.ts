/**
 * DTO Constants
 *
 * Presentation-layer constants for validation and serialization.
 * Isolated from domain layer for proper architectural separation.
 */

/**
 * Run status values.
 */
export const RUN_STATUSES = ['running', 'prepared', 'failed', 'cancelled', 'promoted'] as const;
export type RunStatusType = (typeof RUN_STATUSES)[number];

/**
 * Evaluation context values.
 */
export const EVALUATION_CONTEXTS = ['catalog', 'trending', 'homepage', 'search'] as const;
export type EvaluationContextType = (typeof EVALUATION_CONTEXTS)[number];

/**
 * Media type values.
 */
export const MEDIA_TYPES = ['movie', 'show'] as const;
export type MediaTypeType = (typeof MEDIA_TYPES)[number];

/**
 * Eligibility mode values.
 */
export const ELIGIBILITY_MODES = ['STRICT', 'RELAXED'] as const;
export type EligibilityModeType = (typeof ELIGIBILITY_MODES)[number];

/**
 * Blocked country mode values.
 */
export const BLOCKED_COUNTRY_MODES = ['ANY', 'MAJORITY'] as const;
export type BlockedCountryModeType = (typeof BLOCKED_COUNTRY_MODES)[number];

/**
 * Eligibility status values.
 */
export const ELIGIBILITY_STATUSES = ['ELIGIBLE', 'INELIGIBLE', 'REVIEW'] as const;
export type EligibilityStatusType = (typeof ELIGIBILITY_STATUSES)[number];

/**
 * Rating source values.
 */
export const RATING_SOURCES = ['imdb', 'metacritic', 'rt', 'trakt'] as const;
export type RatingSourceType = (typeof RATING_SOURCES)[number];

/**
 * Availability mode values.
 */
export const AVAILABILITY_MODES = ['subscription_only', 'transactional_only', 'any'] as const;
export type AvailabilityModeType = (typeof AVAILABILITY_MODES)[number];

/**
 * Content class values.
 */
export const CONTENT_CLASSES = ['mainstream', 'anime', 'documentary', 'reality', 'kids'] as const;
export type ContentClassType = (typeof CONTENT_CLASSES)[number];

/**
 * Dry-run mode values.
 */
export const DRY_RUN_MODES = ['sample', 'top', 'byType', 'byCountry'] as const;
export type DryRunModeType = (typeof DRY_RUN_MODES)[number];
