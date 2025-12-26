"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ErrorItem } from './ErrorItem'

interface ErrorSample {
  mediaItemId: string
  error: string
  stack?: string
  timestamp: string
}

interface RunErrorsTabProps {
  errors: ErrorSample[]
  totalErrors: number
  labels: {
    title: string
    found: string
    noData: string
    mediaId: string
    stackTrace: string
  }
}

export function RunErrorsTab({ errors, totalErrors, labels }: RunErrorsTabProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set())

  const toggleError = (idx: number) => {
    const newExpanded = new Set(expandedErrors)
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx)
    } else {
      newExpanded.add(idx)
    }
    setExpandedErrors(newExpanded)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totalErrors} {labels.found}
        </p>
      </CardHeader>
      <CardContent>
        {errors.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {labels.noData}
          </div>
        ) : (
          <div className="space-y-4">
            {errors.map((error, idx) => (
              <ErrorItem
                key={idx}
                error={error}
                isExpanded={expandedErrors.has(idx)}
                onToggle={() => toggleError(idx)}
                labels={{ mediaId: labels.mediaId, stackTrace: labels.stackTrace }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
