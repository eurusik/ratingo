'use client';

import { Check } from 'lucide-react';
import { libraryListRoute } from '@/entities/library';
import type { MediaImportResult } from '@/shared/api';
import { formatCount, formatNumber, interpolate, useTranslation } from '@/shared/i18n';
import type { ImportWizard } from '@/pages/settings/model/import/use-import-wizard';
import { NotFoundList } from './not-found-list';
import { PendingBatch } from './pending-batch';
import { RatedShows } from './rated-shows';
import { STEP_TITLE, StepHeading } from './step-heading';
import { WizardActions } from './wizard-actions';

function ResultStats({ result, isDesktop }: { result: MediaImportResult; isDesktop: boolean }) {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import.result;
  const stats = [
    { label: copy.added, value: result.imported },
    { label: isDesktop ? copy.existingDesk : copy.existing, value: result.skipped },
    { label: copy.notFound, value: result.notFound },
  ];

  return (
    <dl className="grid grid-cols-3 gap-2 md:gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-[18px] bg-surface px-3 py-3.5 md:rounded-[20px] md:p-4.5"
        >
          <dt className="text-xs text-muted md:text-[13px]">{stat.label}</dt>
          <dd className="mt-1 text-[22px] font-extrabold tabular-nums md:mt-1.5 md:text-[28px]">
            {formatNumber(locale, stat.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface ResultStepProps {
  wizard: ImportWizard;
  isDesktop: boolean;
  origin: string;
}

export function ResultStep({ wizard, isDesktop, origin }: ResultStepProps) {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import;
  const { result } = wizard.state;
  if (!result) return null;

  const title =
    result.imported > 0
      ? interpolate(copy.result.title, {
          titles: formatCount(result.imported, copy.titles, locale),
        })
      : copy.result.nothingNew;

  return (
    <>
      <div className="flex flex-col items-center gap-2.5 pt-2 text-center md:flex-row md:gap-3.5 md:pt-0 md:text-start">
        <span
          aria-hidden
          className="flex size-16 items-center justify-center rounded-full bg-success/15 text-success md:size-13"
        >
          <Check className="size-7.5 md:size-6.5" strokeWidth={2.6} />
        </span>
        <StepHeading className={isDesktop ? 'text-2xl font-extrabold' : STEP_TITLE}>
          {title}
        </StepHeading>
        {isDesktop ? null : <p className="text-[15px] text-muted">{origin}</p>}
      </div>
      <ResultStats result={result} isDesktop={isDesktop} />
      {result.pendingBatch ? (
        <PendingBatch pending={result.pendingBatch} importedAt={wizard.state.finishedAt ?? 0} />
      ) : null}
      <RatedShows result={result} isDesktop={isDesktop} />
      <NotFoundList items={result.details.notFound} isDesktop={isDesktop} />
      <WizardActions
        hint={copy.result.footer}
        primary={{ label: copy.result.openHistory, href: libraryListRoute('history') }}
        secondary={{ label: copy.result.again, onPress: wizard.restart }}
        isPinned={false}
      />
    </>
  );
}
