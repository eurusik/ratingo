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
