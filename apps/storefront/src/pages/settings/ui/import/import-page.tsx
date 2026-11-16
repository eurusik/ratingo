'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { DESKTOP_MEDIA_QUERY } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useClientNow, useMediaQuery } from '@/shared/lib';
import { runningProgress } from '@/pages/settings/model/import/import-batches';
import { clockTime, isJustNow } from '@/pages/settings/lib/import/import-moment';
import { useImportBatches } from '@/pages/settings/model/import/import-queries';
import type { ImportStep } from '@/pages/settings/model/import/import-wizard';
import { useLastImport } from '@/pages/settings/model/import/last-import';
import {
  useImportWizard,
  type ImportWizard,
} from '@/pages/settings/model/import/use-import-wizard';
import { useStepHistory } from '@/pages/settings/model/import/use-step-history';
import { useLeaveConfirmation, useLeaveWarning } from '@/pages/settings/model/leave-guard';
import { DiscardDialog } from '../discard-dialog';
import { SectionHeader, type StepBack } from '../settings-headers';
import { SettingsShell } from '../settings-shell';
import { DesktopFilesStep, PhoneFilesStep } from './files-step';
import { PreviewStep } from './preview-step';
import { ResultStep } from './result-step';
import { ResumeCard } from './resume-card';
import { PhoneSourceStep } from './source-step';
import { StepProgress } from './step-progress';
import { STEP_HEADING_ID } from './step-heading';

const PHONE_STEPS: readonly ImportStep[] = ['source', 'files', 'preview'];
const DESKTOP_STEPS: readonly ImportStep[] = ['files', 'preview'];

function desktopStep(step: ImportStep): ImportStep {
  return step === 'source' ? 'files' : step;
}

function useImportMoment(finishedAt: number | undefined): string {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import.result;
  const now = useClientNow();
  if (finishedAt === undefined || isJustNow(now, finishedAt)) return copy.justNow;
  return interpolate(copy.at, { time: clockTime(locale, finishedAt) });
}

function useStepPosition(wizard: ImportWizard, isDesktop: boolean) {
  const { dict } = useTranslation();
  const copy = dict.settings.import;
  const { step, isImporting } = wizard.state;
  const steps = isDesktop ? DESKTOP_STEPS : PHONE_STEPS;
  const shownStep = isDesktop ? desktopStep(step) : step;
  const index = steps.indexOf(shownStep);
  const previous = index > 0 ? steps[index - 1] : undefined;
  const stepName = (name: ImportStep) => copy.steps[name as keyof typeof copy.steps];

  const label =
    index < 0
      ? undefined
      : interpolate(copy.stepOf, {
          step: index + 1,
          total: steps.length,
          name: stepName(shownStep),
        });
  const back: StepBack | undefined =
    previous && !isImporting
      ? {
          label: copy.back,
          ariaLabel: interpolate(copy.backToStep, { step: stepName(previous) }),
          onPress: wizard.back,
        }
      : undefined;

  return { index, label, back };
}

function ImportLeaveGuard({ isActive }: { isActive: boolean }) {
  const { dict } = useTranslation();
  const confirmation = useLeaveConfirmation(isActive);
  useLeaveWarning(isActive);

  return (
    <DiscardDialog
      copy={dict.settings.import.leave}
      isOpen={confirmation.isAsking}
      onKeep={confirmation.stay}
      onDiscard={confirmation.leave}
    />
  );
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
  const copy = dict.settings.import;
  const title = dict.settings.sections.import;
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const wizardState = useImportWizard();
  const historyBack = useStepHistory({
    step: wizardState.state.step,
    isDesktop,
    isImporting: wizardState.state.isImporting,
    stepBack: wizardState.back,
  });
  const wizard: ImportWizard = { ...wizardState, back: historyBack };
  const { step, source, files, finishedAt } = wizard.state;
  const position = useStepPosition(wizard, isDesktop);
  const moment = useImportMoment(finishedAt);
  const resume = useResume(wizard);
  useFocusOnStepChange(step);
  const sourceName = source ? copy.sources[source].name : '';
  const showsPhoneProgress = !isDesktop && position.label && !(step === 'source' && resume);

  return (
    <SettingsShell
      current="import"
      phoneTitle={title}
      desktopTitle={title}
      stepBack={isDesktop ? undefined : position.back}
    >
      <ImportLeaveGuard
        isActive={files.length > 0 && step !== 'result' && !wizard.state.isImporting}
      />
      <SectionHeader
        title={title}
        subtitle={step === 'result' ? `${sourceName} · ${moment}` : position.label}
      />
      <div className="flex flex-col gap-5 md:gap-4">
        {showsPhoneProgress ? (
          <StepProgress
            current={position.index + 1}
            total={PHONE_STEPS.length}
            label={position.label}
          />
        ) : null}
        <WizardBody
          wizard={wizard}
          isDesktop={isDesktop}
          origin={interpolate(copy.result.from, { source: sourceName, when: moment })}
          resume={resume}
        />
      </div>
    </SettingsShell>
  );
}
