'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { ErrorItem } from './ErrorItem';
import type { RunErrorsLabels } from './labels.types';
import { withOccurrenceKeys } from '@/shared/utils';

interface ErrorSample {
  mediaItemId: string;
  error: string;
  stack?: string;
  timestamp: string;
}

interface RunErrorsTabProps {
  errors: ErrorSample[];
  totalErrors: number;
  labels: RunErrorsLabels;
}

function errorSampleKey(sample: ErrorSample): string {
  return `${sample.mediaItemId}-${sample.timestamp}`;
}

/**
 * Displays run errors tab.
 *
 * Shows list of error samples with expand/collapse functionality.
 * Displays empty state when no errors exist.
 *
 * @param errors - Array of error samples
 * @param totalErrors - Total error count
 * @param labels - Localized labels
 */
export function RunErrorsTab({ errors, totalErrors, labels }: RunErrorsTabProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const toggleError = (key: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedErrors(newExpanded);
  };

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
          <div className="text-center text-muted-foreground py-8">{labels.noData}</div>
        ) : (
          <div className="space-y-4">
            {withOccurrenceKeys(errors, errorSampleKey).map(({ item: error, key }) => (
              <ErrorItem
                key={key}
                error={error}
                isExpanded={expandedErrors.has(key)}
                onToggle={() => toggleError(key)}
                labels={{ mediaId: labels.mediaId, stackTrace: labels.stackTrace }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
