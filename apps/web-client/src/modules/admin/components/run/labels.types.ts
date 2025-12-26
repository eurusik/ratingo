/**
 * Label types for run detail components.
 * These types match the JSON structure in locales/[lang].json
 * under admin.runDetail
 */

export interface RunHeaderLabels {
  title: string
  policy: string
  started: string
  promote: string
  cancel: string
  blockingReasonsTitle: string
}

export interface RunDiffLabels {
  title: string
  regressions: string
  improvements: string
  netChange: string
  topRegressions: string
  topImprovements: string
  mediaId: string
  statusChange: string
  loading: string
  regressionBreakdown?: string
  improvementBreakdown?: string
}

export interface RunErrorsLabels {
  title: string
  found: string
  noData: string
  mediaId: string
  stackTrace: string
}
