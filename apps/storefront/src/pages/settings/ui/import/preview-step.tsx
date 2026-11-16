'use client';

import { useState } from 'react';
import { Alert } from '@heroui/react';
import { cn, pluralize } from '@ratingo/web-core/lib';
import { interpolate, useTranslation, type Dictionary } from '@/shared/i18n';
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
import { StepProgress } from './step-progress';
import { STEP_HEADING_ID, STEP_TITLE } from './step-title';
import { WizardActions } from './wizard-actions';

const PREVIEW_ROWS = 20;

type ImportCopy = Dictionary['settings']['import'];

function useCounts() {
  const { locale } = useTranslation();
  return (forms: ImportCopy['titles'], count: number) =>
    interpolate(pluralize(count, forms, locale), { count });
}

function ratedShowsNote(summary: ImportSummary, copy: ImportCopy['preview']): string | undefined {
  if (summary.ratedShows > 0) return interpolate(copy.ratedShows, { count: summary.ratedShows });
  return summary.hasUntypedRatings ? copy.ratedShowsUntyped : undefined;
}

function PreviewNotes({ summary, isDesktop }: { summary: ImportSummary; isDesktop: boolean }) {
  const { dict } = useTranslation();
  const copy = dict.settings.import;
  const count = useCounts();
  const notes = [
    ratedShowsNote(summary, copy.preview),
    !isDesktop && summary.skippedRows > 0
      ? interpolate(copy.preview.skipped, { rows: count(copy.rows, summary.skippedRows) })
      : undefined,
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

export function PreviewStep({ wizard, isDesktop }: { wizard: ImportWizard; isDesktop: boolean }) {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import;
  const count = useCounts();
  const [isConfirming, setIsConfirming] = useState(false);
  const { state } = wizard;
  const summary = summarizeImport(state.files);
  if (!state.source) return null;

  const sourceName = copy.sources[state.source].name;
  const total = summary.items.length;
  const isTooMany = total > MAX_IMPORT_ITEMS;
  const titles = count(copy.titles, total);
  const flow = [
    summary.ratings > 0
      ? interpolate(copy.files.toHistory, { count: count(copy.ratings, summary.ratings) })
      : undefined,
    summary.watchlist > 0
      ? interpolate(copy.files.toPlan, { count: summary.watchlist })
      : undefined,
  ];
  const skipped =
    isDesktop && summary.skippedRows > 0
      ? interpolate(copy.preview.skipped, { rows: count(copy.rows, summary.skippedRows) })
      : undefined;
  const shown = filterItems(summary.items, state.filter);
  const hidden = shown.length - PREVIEW_ROWS;

  const submit = () => {
    if (state.overwrite) setIsConfirming(true);
    else wizard.submit();
  };

  const filters = (
    [
      { id: 'all', label: copy.preview.filters.all, count: total },
      { id: 'ratings', label: copy.preview.filters.ratings, count: summary.ratings },
      { id: 'watchlist', label: copy.preview.filters.watchlist, count: summary.watchlist },
    ] satisfies { id: PreviewFilter; label: string; count: number }[]
  ).filter((option) => option.id === 'all' || option.count > 0);

  return (
    <>
      {isDesktop ? <StepProgress current={2} total={2} className="max-w-90" /> : null}
      <div className="flex flex-col gap-1.5 md:gap-1">
        <h2
          id={STEP_HEADING_ID}
          tabIndex={-1}
          className={cn(isDesktop ? 'text-[22px] font-extrabold' : STEP_TITLE, 'outline-none')}
        >
          {isDesktop
            ? interpolate(copy.preview.fromSource, { titles, source: sourceName })
            : titles}
        </h2>
        <p className="text-[15px] leading-snug text-muted tabular-nums">
          {[...flow, skipped].filter(Boolean).join(' · ')}
        </p>
      </div>
      {isTooMany ? (
        <Alert status="danger" className="rounded-2xl">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>
              {interpolate(copy.preview.tooMany, {
                max: MAX_IMPORT_ITEMS.toLocaleString(locale),
              })}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
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
          {interpolate(copy.preview.more, { count: hidden })}
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
          label: interpolate(copy.preview.submit, { count: total }),
          onPress: submit,
          isPending: state.isImporting,
          isDisabled: isTooMany,
        }}
        secondary={{ label: copy.back, onPress: wizard.back, isDisabled: state.isImporting }}
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
