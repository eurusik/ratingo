/**
 * Report status constants
 */
export const ReportStatus = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  DISMISSED: 'dismissed',
  ACTIONED: 'actioned',
} as const;

export type ReportStatusType = (typeof ReportStatus)[keyof typeof ReportStatus];

export const REPORT_STATUS_VALUES = Object.values(ReportStatus);

/**
 * Report reason constants
 */
export const ReportReason = {
  SPAM: 'spam',
  HARASSMENT: 'harassment',
  HATE_SPEECH: 'hate_speech',
  MISINFORMATION: 'misinformation',
  SPOILER_UNMARKED: 'spoiler_unmarked',
  OTHER: 'other',
} as const;

export type ReportReasonType = (typeof ReportReason)[keyof typeof ReportReason];

export const REPORT_REASON_VALUES = Object.values(ReportReason);
