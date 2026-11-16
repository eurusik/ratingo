'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { DESKTOP_MEDIA_QUERY } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useClientNow, useMediaQuery } from '@/shared/lib';
import { runningProgress } from '@/pages/settings/model/import/import-batches';
import { clockTime, isJustNow } from '@/pages/settings/model/import/import-moment';
import { useImportBatches } from '@/pages/settings/model/import/import-queries';
import type { ImportStep } from '@/pages/settings/model/import/import-wizard';
import { useLastImport } from '@/pages/settings/model/import/last-import';
import {
  useImportWizard,
  type ImportWizard,
} from '@/pages/settings/model/import/use-import-wizard';
import { SectionHeader, type StepBack } from '../settings-headers';
import { SettingsShell } from '../settings-shell';
import { DesktopFilesStep, PhoneFilesStep, PhoneSourceStep } from './files-step';
import { PreviewStep } from './preview-step';
import { ResultStep } from './result-step';
import { ResumeCard } from './resume-card';
import { StepProgress } from './step-progress';
import { STEP_HEADING_ID } from './step-title';

const PHONE_STEPS: readonly ImportStep[] = ['source', 'files', 'preview'];
const DESKTOP_STEPS: readonly ImportStep[] = ['files', 'preview'];

function desktopStep(step: ImportStep): ImportStep {
  return step === 'source' ? 'files' : step;
}

function useStepCopy(wizard: ImportWizard, isDesktop: boolean) {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import;
  const now = useClientNow();
  const { step, source, finishedAt } = wizard.state;
  const steps = isDesktop ? DESKTOP_STEPS : PHONE_STEPS;
  const shownStep = isDesktop ? desktopStep(step) : step;
  const index = steps.indexOf(shownStep);
  const sourceName = source ? copy.sources[source].name : '';
  const when =
    finishedAt === undefined || isJustNow(now, finishedAt)
      ? copy.result.justNow
      : interpolate(copy.result.at, { time: clockTime(locale, finishedAt) });

  const stepLabel =
    index < 0
      ? undefined
      : interpolate(copy.stepOf, {
          step: index + 1,
          total: steps.length,
          name: copy.steps[shownStep as keyof typeof copy.steps],
        });
  const previous = index > 0 ? steps[index - 1] : undefined;
  const stepBack: StepBack | undefined =
    previous && !wizard.state.isImporting
      ? {
          label: copy.back,
          ariaLabel: interpolate(copy.backToStep, {
            step: copy.steps[previous as keyof typeof copy.steps],
          }),
          onPress: wizard.back,
        }
      : undefined;

  return {
    stepLabel,
    stepIndex: index,
    stepBack,
    origin: interpolate(copy.result.from, { source: sourceName, when }),
    resultSubtitle: `${sourceName} · ${when}`,
  };
}

interface WizardBodyProps {
  wizard: ImportWizard;
  isDesktop: boolean;
  origin: string;
  resume: ReactNode;
}

function WizardBody({ wizard, isDesktop, origin, resume }: WizardBodyProps) {
  const { step } = wizard.state;
  if (step === 'result')
    return <ResultStep wizard={wizard} isDesktop={isDesktop} origin={origin} />;
  if (step === 'preview') return <PreviewStep wizard={wizard} isDesktop={isDesktop} />;
  if (isDesktop) return <DesktopFilesStep wizard={wizard} resume={resume} />;
  if (step === 'files') return <PhoneFilesStep wizard={wizard} />;
  return <PhoneSourceStep resume={resume} onPick={wizard.pickSource} />;
}

function useResume(wizard: ImportWizard): ReactNode {
  const { user } = useAuth();
  const batches = useImportBatches();
  const lastImport = useLastImport(user?.id);
  const progress = runningProgress(batches.data);
  if (!progress) return null;
  const pendingId = lastImport?.result.pendingBatch?.batchId;
  const summary = pendingId && progress.batchIds.includes(pendingId) ? lastImport : undefined;
  return <ResumeCard progress={progress} lastImport={summary} onSummary={wizard.showSummary} />;
}

function useFocusOnStepChange(step: ImportStep) {
  const shownStep = useRef(step);

  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    window.scrollTo({ top: 0 });
    document.getElementById(STEP_HEADING_ID)?.focus({ preventScroll: true });
  }, [step]);
}

export function ImportSettingsPage() {
  const { dict } = useTranslation();
  const title = dict.settings.sections.import;
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const wizard = useImportWizard();
  const stepCopy = useStepCopy(wizard, isDesktop);
  const resume = useResume(wizard);
  const { step } = wizard.state;
  useFocusOnStepChange(step);
  const showsPhoneProgress = !isDesktop && stepCopy.stepLabel && !(step === 'source' && resume);

  return (
    <SettingsShell
      current="import"
      phoneTitle={title}
      desktopTitle={title}
      stepBack={isDesktop ? undefined : stepCopy.stepBack}
    >
      <SectionHeader
        title={title}
        subtitle={step === 'result' ? stepCopy.resultSubtitle : stepCopy.stepLabel}
      />
      <div className="flex flex-col gap-5 md:gap-4">
        {showsPhoneProgress ? (
          <StepProgress
            current={stepCopy.stepIndex + 1}
            total={PHONE_STEPS.length}
            label={stepCopy.stepLabel}
          />
        ) : null}
        <WizardBody
          wizard={wizard}
          isDesktop={isDesktop}
          origin={stepCopy.origin}
          resume={resume}
        />
      </div>
    </SettingsShell>
  );
}
