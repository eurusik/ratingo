'use client';

import { Button } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { BatchProgress } from '@/pages/settings/model/import/import-batches';
import { isImportSource } from '@/pages/settings/model/import/import-sources';
import type { LastImport } from '@/pages/settings/model/import/last-import';
import { ProgressCard } from './progress-card';
import { StopButton } from './stop-button';

interface ResumeCardProps {
  progress: BatchProgress;
  lastImport?: LastImport;
  onSummary: (entry: LastImport) => void;
}

export function ResumeCard({ progress, lastImport, onSummary }: ResumeCardProps) {
  const { dict } = useTranslation();
  const copy = dict.settings.import;
  const sourceName = isImportSource(progress.source)
    ? copy.sources[progress.source].name
    : progress.source;
  const text = lastImport
    ? interpolate(copy.resume.textWithCount, { count: lastImport.result.imported })
    : copy.resume.text;

  return (
    <ProgressCard
      isHighlighted
      title={interpolate(copy.resume.title, { source: sourceName })}
      done={progress.done}
      total={progress.total}
      text={text}
      actions={
        <>
          {lastImport ? (
            <Button
              size="sm"
              variant="secondary"
              onPress={() => onSummary(lastImport)}
              className="h-11 rounded-full px-3.5 font-semibold md:h-9"
            >
              {copy.resume.summary}
            </Button>
          ) : null}
          <StopButton batchIds={progress.batchIds} />
        </>
      }
    />
  );
}
