'use client';

import { useMemo, useState } from 'react';
import { Alert } from '@heroui/react';
import {
  formatCount,
  formatNumber,
  interpolate,
  useTranslation,
  type Dictionary,
} from '@/shared/i18n';
import { SegmentedFilter } from '@/shared/ui';
import {
  MAX_IMPORT_ITEMS,
  filterItems,
  summarizeImport,
  type ImportSummary,
} from '@/pages/settings/model/import/import-summary';
import type { PreviewFilter } from '@/pages/settings/model/import/import-wizard';
import type { ImportWizard } from '@/pages/settings/model/import/use-import-wizard';
import { SettingSwitch } from '../setting-switch';
import { OverwriteDialog } from './overwrite-dialog';
import { PreviewRows } from './preview-rows';
import { STEP_TITLE, StepHeading } from './step-heading';
import { StepProgress } from './step-progress';
import { WizardActions } from './wizard-actions';

const PREVIEW_ROWS = 20;

type PreviewCopy = Dictionary['settings']['import']['preview'];

function ratedShowsNote(summary: ImportSummary, copy: PreviewCopy): string | undefined {
  if (summary.ratedShows > 0) return interpolate(copy.ratedShows, { count: summary.ratedShows });
  return summary.hasUntypedRatings ? copy.ratedShowsUntyped : undefined;
}

function useSkippedNote(summary: ImportSummary): string | undefined {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import;
  if (summary.skippedRows === 0) return undefined;
  return interpolate(copy.preview.skipped, {
    rows: formatCount(summary.skippedRows, copy.rows, locale),
  });
}

function PreviewNotes({ summary, isDesktop }: { summary: ImportSummary; isDesktop: boolean }) {
  const { dict } = useTranslation();
  const skipped = useSkippedNote(summary);
  const notes = [
    ratedShowsNote(summary, dict.settings.import.preview),
    isDesktop ? undefined : skipped,
  ].filter((note): note is string => note !== undefined);

  if (notes.length === 0) return null;
  return (
    <Alert status="warning" className="rounded-2xl bg-warning/10">
      <Alert.Content className="gap-1.5">
        {notes.map((note) => (
          <Alert.Description
            key={note}
            className="text-sm leading-snug text-warning md:text-[15px]"
          >
            {note}
          </Alert.Description>
        ))}
      </Alert.Content>
    </Alert>
  );
}

function PreviewHeader({
  summary,
  sourceName,
  isDesktop,
}: {
  summary: ImportSummary;
  sourceName: string;
  isDesktop: boolean;
}) {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import;
  const skipped = useSkippedNote(summary);
  const titles = formatCount(summary.items.length, copy.titles, locale);
  const flow = [
    summary.ratings > 0
      ? interpolate(copy.files.toHistory, {
          count: formatCount(summary.ratings, copy.ratings, locale),
        })
      : undefined,
    summary.watchlist > 0
      ? interpolate(copy.files.toPlan, { count: formatNumber(locale, summary.watchlist) })
      : undefined,
    isDesktop ? skipped : undefined,
  ];

  return (
    <div className="flex flex-col gap-1.5 md:gap-1">
      <StepHeading className={isDesktop ? 'text-[22px] font-extrabold' : STEP_TITLE}>
        {isDesktop ? interpolate(copy.preview.fromSource, { titles, source: sourceName }) : titles}
      </StepHeading>
      <p className="text-[15px] leading-snug text-muted tabular-nums">
        {flow.filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}

function TooManyAlert() {
  const { dict, locale } = useTranslation();
  return (
    <Alert status="danger" className="rounded-2xl">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>
          {interpolate(dict.settings.import.preview.tooMany, {
            max: formatNumber(locale, MAX_IMPORT_ITEMS),
          })}
        </Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

function useFilterOptions(summary: ImportSummary) {
  const { dict } = useTranslation();
  const labels = dict.settings.import.preview.filters;
  const options: { id: PreviewFilter; label: string; count: number }[] = [
    { id: 'all', label: labels.all, count: summary.items.length },
    { id: 'ratings', label: labels.ratings, count: summary.ratings },
    { id: 'watchlist', label: labels.watchlist, count: summary.watchlist },
  ];
  return options.filter((option) => option.id === 'all' || option.count > 0);
}

export function PreviewStep({ wizard, isDesktop }: { wizard: ImportWizard; isDesktop: boolean }) {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import;
  const [isConfirming, setIsConfirming] = useState(false);
  const { state } = wizard;
  const summary = useMemo(() => summarizeImport(state.files), [state.files]);
  const shown = useMemo(() => filterItems(summary.items, state.filter), [summary, state.filter]);
  const filters = useFilterOptions(summary);
  if (!state.source) return null;

  const sourceName = copy.sources[state.source].name;
  const total = summary.items.length;
  const isTooMany = total > MAX_IMPORT_ITEMS;
  const hidden = shown.length - PREVIEW_ROWS;

  const submit = () => {
    if (state.overwrite) setIsConfirming(true);
    else wizard.submit();
  };

  return (
    <>
      {isDesktop ? <StepProgress current={2} total={2} className="max-w-90" /> : null}
      <PreviewHeader summary={summary} sourceName={sourceName} isDesktop={isDesktop} />
      {isTooMany ? <TooManyAlert /> : null}
      <PreviewNotes summary={summary} isDesktop={isDesktop} />
      {filters.length > 2 ? (
        <SegmentedFilter
          label={copy.preview.filterLabel}
          options={filters}
          value={state.filter}
          onChange={wizard.setFilter}
          isScrollable={!isDesktop}
          className={isDesktop ? 'px-0' : undefined}
        />
      ) : null}
      <PreviewRows items={shown.slice(0, PREVIEW_ROWS)} />
      {hidden > 0 ? (
        <p className="-mt-2 text-center text-[13px] text-muted md:text-start">
          {interpolate(copy.preview.more, { count: formatNumber(locale, hidden) })}
        </p>
      ) : null}
      <div className="rounded-[20px] bg-surface px-3.5 md:rounded-3xl md:px-5">
        <SettingSwitch
          label={copy.preview.overwrite}
          hint={copy.preview.overwriteHint}
          isSelected={state.overwrite}
          onChange={wizard.setOverwrite}
        />
      </div>
      <WizardActions
        hint={copy.preview.safe}
        primary={{
          label: interpolate(copy.preview.submit, { count: formatNumber(locale, total) }),
          onPress: submit,
          isPending: state.isImporting,
          isDisabled: isTooMany,
        }}
        secondary={{ label: copy.back, onPress: wizard.back, isDisabled: state.isImporting }}
        isPinned
      />
      <OverwriteDialog
        isOpen={isConfirming}
        sourceName={sourceName}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() => {
          setIsConfirming(false);
          wizard.submit();
        }}
      />
    </>
  );
}
