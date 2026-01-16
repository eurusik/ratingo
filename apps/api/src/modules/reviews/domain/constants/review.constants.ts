/**
 * Review system limits and constants.
 */
export const REVIEW_LIMITS = {
  /** Maximum content length (like Twitter) */
  MAX_CONTENT_LENGTH: 280,
  /** Minimum rating value */
  MIN_RATING: 0,
  /** Maximum rating value */
  MAX_RATING: 100,
  /** Maximum nesting depth for replies (parent -> reply -> reply) */
  MAX_REPLIES_DEPTH: 2,
  /** Maximum reviews a user can create per day */
  RATE_LIMIT_REVIEWS_PER_DAY: 20,
  /** Maximum reports a user can submit per day */
  RATE_LIMIT_REPORTS_PER_DAY: 10,
} as const;

/**
 * Sort options for reviews list.
 */
export const REVIEW_SORT = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  MOST_LIKED: 'most_liked',
} as const;

export type ReviewSort = (typeof REVIEW_SORT)[keyof typeof REVIEW_SORT];
export const REVIEW_SORT_VALUES = Object.values(REVIEW_SORT);

/**
 * Vote types for reviews.
 */
export const VOTE_TYPE = {
  LIKE: 'like',
  DISLIKE: 'dislike',
} as const;

export type VoteType = (typeof VOTE_TYPE)[keyof typeof VOTE_TYPE];
export const VOTE_TYPE_VALUES = Object.values(VOTE_TYPE);

/**
 * Report reasons for reviews.
 */
export const REPORT_REASON = {
  SPAM: 'spam',
  HARASSMENT: 'harassment',
  HATE_SPEECH: 'hate_speech',
  MISINFORMATION: 'misinformation',
  SPOILER_UNMARKED: 'spoiler_unmarked',
  OTHER: 'other',
} as const;

export type ReportReason = (typeof REPORT_REASON)[keyof typeof REPORT_REASON];
export const REPORT_REASON_VALUES = Object.values(REPORT_REASON);

/**
 * Report status for moderation workflow.
 */
export const REPORT_STATUS = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  DISMISSED: 'dismissed',
  ACTIONED: 'actioned',
} as const;

export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];
export const REPORT_STATUS_VALUES = Object.values(REPORT_STATUS);
