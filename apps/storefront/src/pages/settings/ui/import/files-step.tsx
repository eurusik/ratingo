'use client';

import { useId, type ReactNode } from 'react';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { ImportWizard } from '@/pages/settings/model/import/use-import-wizard';
import { FileList } from './file-list';
import { FilePicker } from './file-picker';
import { HowTo } from './how-to';
import { SourceTiles } from './source-tiles';
import { StepProgress } from './step-progress';
import { STEP_HEADING_ID, STEP_TITLE, StepHeading } from './step-heading';
import { WizardActions } from './wizard-actions';

function useNextAction(wizard: ImportWizard) {
  const { dict } = useTranslation();
  return {
    label: dict.settings.import.files.next,
    onPress: wizard.review,
    isDisabled: !wizard.canReview,
    isPending: wizard.isReading,
  };
}

export function PhoneFilesStep({ wizard }: { wizard: ImportWizard }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import;
  const next = useNextAction(wizard);
  const { source, files } = wizard.state;
  if (!source) return null;
  const sourceName = copy.sources[source].name;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <StepHeading className={STEP_TITLE}>
          {interpolate(copy.files.title, { source: sourceName })}
        </StepHeading>
        <p className="text-[15px] leading-snug text-muted">{copy.files.text}</p>
      </div>
      <HowTo source={source} isDesktop={false} />
      <FilePicker isDesktop={false} onFiles={wizard.addFiles} />
      <FileList files={files} sourceName={sourceName} onRemove={wizard.removeFile} />
      <p className="mx-1 text-[13px] text-muted">{copy.files.localOnly}</p>
      <WizardActions primary={next} isPinned />
    </>
  );
}

export function DesktopFilesStep({ wizard, resume }: { wizard: ImportWizard; resume?: ReactNode }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import;
  const next = useNextAction(wizard);
  const filesLabelId = useId();
  const { source, files } = wizard.state;
  const sourceName = source ? copy.sources[source].name : '';

  return (
    <>
      {resume}
      <StepProgress current={1} total={2} className="max-w-90" />
      <section aria-labelledby={STEP_HEADING_ID} className="flex flex-col gap-2.5">
        <StepHeading className="text-[17px] font-extrabold">{copy.source.label}</StepHeading>
        <SourceTiles labelId={STEP_HEADING_ID} value={source} onChange={wizard.pickSource} />
      </section>
      {source ? (
        <>
          <section aria-labelledby={filesLabelId} className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-2.5">
              <h2 id={filesLabelId} className="text-[17px] font-extrabold">
                {interpolate(copy.files.title, { source: sourceName })}
              </h2>
              <span className="text-sm text-muted">{copy.files.deskText}</span>
            </div>
            <div className={files.length > 0 ? 'grid grid-cols-2 items-start gap-3' : undefined}>
              <FilePicker isDesktop onFiles={wizard.addFiles} />
              <FileList files={files} sourceName={sourceName} onRemove={wizard.removeFile} />
            </div>
          </section>
          <HowTo source={source} isDesktop />
        </>
      ) : null}
      <WizardActions hint={copy.files.footer} primary={next} isPinned />
    </>
  );
}
