"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { CheckCircle, XCircle, BarChart3 } from 'lucide-react'
import type { DiffReportDto } from '@/core/api/admin'
import { DiffItemList } from './DiffItemList'
import type { RunDiffLabels } from './labels.types'

interface RunDiffTabProps {
  diffReport: DiffReportDto | undefined
  isLoading: boolean
  labels: RunDiffLabels
}

/**
 * Displays run diff report tab.
 * 
 * Shows summary counts and lists of regressions/improvements.
 * Displays loading state while fetching data.
 *
 * @param diffReport - Diff report data
 * @param isLoading - Whether data is loading
 * @param labels - Localized labels
 */
export function RunDiffTab({ diffReport, isLoading, labels }: RunDiffTabProps) {
  if (isLoading || !diffReport) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">{labels.loading}</div>
        </CardContent>
      </Card>
    )
  }

  const { counts, topRegressions, topImprovements, reasonBreakdown } = diffReport

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <div className="flex space-x-4 text-sm text-muted-foreground">
          <span className="flex items-center">
            <XCircle className="h-4 w-4 text-red-600 mr-1" />
            {counts.regressions} {labels.regressions}
          </span>
          <span className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
            {counts.improvements} {labels.improvements}
          </span>
          <span className="flex items-center">
            {labels.netChange}: {counts.netChange > 0 ? '+' : ''}{counts.netChange}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reason Breakdown */}
        {reasonBreakdown && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(reasonBreakdown.regressionReasons || {}).length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <h3 className="text-sm font-medium mb-3 text-red-600 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  {labels.regressionBreakdown || 'Regression Breakdown'}
                </h3>
                <div className="space-y-2">
                  {Object.entries(reasonBreakdown.regressionReasons)
                    .sort(([, a], [, b]) => b - a)
                    .map(([reason, count]) => (
                      <div key={reason} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{reason}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
            {Object.keys(reasonBreakdown.improvementReasons || {}).length > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <h3 className="text-sm font-medium mb-3 text-green-600 flex items-center">
                  <BarChart3 className="h-4 w-4 mr-1" />
                  {labels.improvementBreakdown || 'Improvement Breakdown'}
                </h3>
                <div className="space-y-2">
                  {Object.entries(reasonBreakdown.improvementReasons)
                    .sort(([, a], [, b]) => b - a)
                    .map(([reason, count]) => (
                      <div key={reason} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{reason}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {topRegressions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 text-red-600">{labels.topRegressions}</h3>
            <DiffItemList
              items={topRegressions}
              variant="regression"
              labels={{ mediaId: labels.mediaId, statusChange: labels.statusChange }}
            />
          </div>
        )}
        {topImprovements.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 text-green-600">{labels.topImprovements}</h3>
            <DiffItemList
              items={topImprovements}
              variant="improvement"
              labels={{ mediaId: labels.mediaId, statusChange: labels.statusChange }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
