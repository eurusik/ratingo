'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/shared/i18n';
import type { ImportSource } from '@/pages/settings/model/import/import-sources';
import { SourceList } from './source-list';
import { STEP_TITLE, StepHeading } from './step-heading';

export function PhoneSourceStep({
  resume,
  onPick,
}: {
  resume?: ReactNode;
  onPick: (source: ImportSource) => void;
}) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.source;

  return (
    <>
      {resume}
      <div className="flex flex-col gap-1.5">
        <StepHeading className={STEP_TITLE}>{resume ? copy.resumeTitle : copy.title}</StepHeading>
        <p className="text-[15px] leading-snug text-muted">{copy.text}</p>
      </div>
      <SourceList onPick={onPick} />
    </>
  );
}
