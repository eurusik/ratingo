'use client';

import { CheckCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Progress } from '@/shared/ui/progress';

export interface ImportPendingStatusLabels {
  title: string;
  progress: string;
  failed: string;
  failedHint: string;
  completed: string;
}

interface ImportPendingStatusProps {
  totalItems: number;
  completedCount: number;
  failedCount: number;
  status: 'processing' | 'completed';
  labels: ImportPendingStatusLabels;
}

export function ImportPendingStatus({
  totalItems,
  completedCount,
  failedCount,
  status,
  labels,
}: ImportPendingStatusProps) {
  const processedCount = completedCount + failedCount;
  const progressPercent = totalItems > 0 ? Math.round((processedCount / totalItems) * 100) : 0;

  const progressText = labels.progress
    .replace('{done}', String(processedCount))
    .replace('{total}', String(totalItems));

  const failedText = labels.failed.replace('{count}', String(failedCount));

  return (
    <div className="border border-cinema-borderSoft bg-cinema-card rounded-md p-4 space-y-3" aria-live="polite" aria-atomic="true">
      {status === 'completed' ? (
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-sm text-cinema-text-primary">{labels.completed}</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-cinema-text-muted animate-spin shrink-0" />
            <span className="text-sm font-medium text-cinema-text-primary">{labels.title}</span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
          <p className="text-xs text-cinema-text-muted">{progressText}</p>
        </>
      )}

      {failedCount > 0 && (
        <div className="flex items-start gap-2 pt-1">
          <Badge variant="outline" className="text-cinema-text-muted shrink-0">
            {failedText}
          </Badge>
          <span className="text-xs text-cinema-text-muted">{labels.failedHint}</span>
        </div>
      )}
    </div>
  );
}
