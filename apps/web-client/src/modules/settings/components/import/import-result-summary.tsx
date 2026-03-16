'use client';

import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import type { ImportResult } from '@/core/api/user-media.client';
import { useImportBatchStatus, type ImportBatchStatus } from '../../hooks/use-import-batch-status';
import { useCancelImportBatches } from '../../hooks/use-import-media';
import { ImportPendingStatus, type ImportPendingStatusLabels } from './import-pending-status';
import { BATCH_STATUS, type BatchStatus } from './types';

function deriveStatus(
  hasPending: boolean,
  batches: ImportBatchStatus[],
  loaded: boolean,
): BatchStatus {
  if (!hasPending) return BATCH_STATUS.COMPLETED;
  if (!loaded) return BATCH_STATUS.PROCESSING;
  if (batches.length === 0) return BATCH_STATUS.COMPLETED;
  if (batches.every((b) => b.status === BATCH_STATUS.COMPLETED)) return BATCH_STATUS.COMPLETED;
  // If any batch is cancelled and none are still processing, surface cancelled
  const hasProcessing = batches.some((b) => b.status === BATCH_STATUS.PROCESSING);
  const hasCancelled = batches.some((b) => b.status === BATCH_STATUS.CANCELLED);
  if (hasCancelled && !hasProcessing) return BATCH_STATUS.CANCELLED;
  return BATCH_STATUS.PROCESSING;
}

interface ImportResultSummaryProps {
  result: ImportResult;
  onImportMore: () => void;
  doneLabel: string;
  importedLabel: string;
  skippedLabel: string;
  notFoundLabel: string;
  goToRatingsLabel: string;
  importMoreLabel: string;
  pendingLabels?: ImportPendingStatusLabels;
}

export function ImportResultSummary({
  result,
  onImportMore,
  doneLabel,
  importedLabel,
  skippedLabel,
  notFoundLabel,
  goToRatingsLabel,
  importMoreLabel,
  pendingLabels,
}: ImportResultSummaryProps) {
  const router = useRouter();
  const [isNotFoundOpen, setIsNotFoundOpen] = useState(false);

  const pendingBatch = result.pendingBatch;

  const hasPendingBatch = Boolean(pendingBatch && pendingLabels);

  // Only poll when there is a pending batch to track
  const { data: batchStatuses } = useImportBatchStatus({ enabled: hasPendingBatch });

  const cancelMutation = useCancelImportBatches();

  // Find the live status for the batch returned by this import
  // Aggregate status across ALL active batches (import may create multiple batches)
  const allBatches = batchStatuses ?? [];
  const totalItems = hasPendingBatch
    ? allBatches.reduce((sum, b) => sum + b.totalItems, 0) || pendingBatch!.totalItems
    : 0;
  const completedCount = allBatches.reduce((sum, b) => sum + b.completedCount, 0);
  const failedCount = allBatches.reduce((sum, b) => sum + b.failedCount, 0);
  const effectiveStatus = deriveStatus(hasPendingBatch, allBatches, batchStatuses !== undefined);

  const processingBatchIds = allBatches
    .filter((b) => b.status === BATCH_STATUS.PROCESSING)
    .map((b) => b.batchId);

  const handleCancel = () => {
    if (processingBatchIds.length > 0) {
      cancelMutation.mutate(processingBatchIds);
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-green-500/40 bg-green-500/10">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-cinema-text-primary">{doneLabel}</AlertTitle>
        <AlertDescription>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-cinema-text-muted">{importedLabel}</span>
              <Badge variant="secondary">{result.imported.toLocaleString('uk')}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cinema-text-muted">{skippedLabel}</span>
              <Badge variant="outline">{result.skipped.toLocaleString('uk')}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cinema-text-muted">{notFoundLabel}</span>
              <Badge variant="outline" className="text-cinema-text-muted">
                {result.notFound.toLocaleString('uk')}
              </Badge>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {result.notFound > 0 && result.details?.notFound?.length > 0 && (
        <Collapsible open={isNotFoundOpen} onOpenChange={setIsNotFoundOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-md border border-cinema-borderSoft bg-cinema-card px-4 py-2.5 text-sm text-cinema-text-muted hover:bg-cinema-elevated transition-colors"
            >
              <span>
                {notFoundLabel}: {result.notFound}
              </span>
              {isNotFoundOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 max-h-48 overflow-y-auto divide-y divide-cinema-borderSoft rounded-md border border-cinema-borderSoft bg-cinema-card">
              {result.details?.notFound?.map((item, idx) => (
                <li key={idx} className="px-4 py-2 text-sm">
                  <span className="text-cinema-text-primary">{item.title ?? '—'}</span>
                  {item.imdbId && (
                    <span className="ml-2 text-cinema-text-muted text-xs">{item.imdbId}</span>
                  )}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}

      {hasPendingBatch && pendingLabels && (
        <ImportPendingStatus
          totalItems={totalItems}
          completedCount={completedCount}
          failedCount={failedCount}
          status={effectiveStatus}
          labels={pendingLabels}
          onCancel={effectiveStatus === BATCH_STATUS.PROCESSING ? handleCancel : undefined}
          isCancelling={cancelMutation.isPending}
        />
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="flex-1"
          onClick={() => router.push('/activity')}
        >
          {goToRatingsLabel}
        </Button>
        <Button
          variant="ghost"
          className="flex-1 text-cinema-text-muted hover:text-cinema-text-primary"
          onClick={onImportMore}
        >
          {importMoreLabel}
        </Button>
      </div>
    </div>
  );
}
