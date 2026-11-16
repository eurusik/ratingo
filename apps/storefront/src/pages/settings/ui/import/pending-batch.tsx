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

const FINISHED_COPY = {
  running: undefined,
  unknown: undefined,
  completed: 'completed',
  cancelled: 'cancelled',
} as const;

export function PendingBatch({ pending }: { pending: PendingSummary }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.pending;
  const batches = useImportBatches();
  const batch = batches.data?.find((candidate) => candidate.batchId === pending.batchId);
  const outcome = batchOutcome(batches.data, pending.batchId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (outcome !== 'running') void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
  }, [outcome, queryClient]);

  const finished = FINISHED_COPY[outcome];
  const total = batch?.totalItems ?? pending.totalItems;

  return (
    <div className="contents">
      <p role="status" className="sr-only">
        {finished ? copy[finished] : ''}
      </p>
      {finished ? (
        <Alert status={finished === 'completed' ? 'success' : 'default'} className="rounded-2xl">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{copy[finished]}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {outcome === 'running' ? (
        <ProgressCard
          title={interpolate(copy.title, { count: total })}
          done={batch ? batch.completedCount + batch.failedCount : 0}
          total={total}
          text={copy.text}
          actions={<StopButton batchIds={[pending.batchId]} />}
        />
      ) : null}
    </div>
  );
}
