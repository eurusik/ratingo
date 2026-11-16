'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '@heroui/react';
import { LIBRARY_QUERY_KEY } from '@/entities/library';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { MediaImportResult } from '@/shared/api';
import { batchOutcome } from '@/pages/settings/model/import/import-batches';
import { useImportBatches } from '@/pages/settings/model/import/import-queries';
import { ProgressCard } from './progress-card';
import { StopButton } from './stop-button';

type PendingSummary = NonNullable<MediaImportResult['pendingBatch']>;

export function PendingBatch({ pending }: { pending: PendingSummary }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.pending;
  const batches = useImportBatches();
  const batch = batches.data?.find((candidate) => candidate.batchId === pending.batchId);
  const outcome = batchOutcome(batch);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (outcome !== 'running') void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
  }, [outcome, queryClient]);

  if (outcome !== 'running') {
    return (
      <Alert status={outcome === 'completed' ? 'success' : 'default'} className="rounded-2xl">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description role="status">
            {outcome === 'completed' ? copy.completed : copy.cancelled}
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  const total = batch?.totalItems ?? pending.totalItems;
  return (
    <ProgressCard
      title={interpolate(copy.title, { count: total })}
      done={batch ? batch.completedCount + batch.failedCount : 0}
      total={total}
      text={copy.text}
      actions={<StopButton batchIds={[pending.batchId]} />}
    />
  );
}
