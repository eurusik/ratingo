"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { CheckCircle, XCircle } from 'lucide-react'
import type { DiffReportDto } from '@/core/api/admin'
import { DiffItemList } from './DiffItemList'

interface RunDiffTabProps {
  diffReport: DiffReportDto | undefined
  isLoading: boolean
  labels: {
    title: string
    regressions: string
    improvements: string
    netChange: string
    topRegressions: string
    topImprovements: string
    mediaId: string
    statusChange: string
    loading: string
  }
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

  const { counts, topRegressions, topImprovements } = diffReport

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
