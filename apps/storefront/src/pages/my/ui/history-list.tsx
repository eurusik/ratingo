'use client';

import { useState } from 'react';
import { Button, SearchField } from '@heroui/react';
import { pluralize } from '@ratingo/web-core/lib';
import { IMPORT_ROUTE, mediaRoute } from '@/shared/config';
import { interpolate, useTranslation, type Locale } from '@/shared/i18n';
import { SegmentedFilter } from '@/shared/ui';
import { useLibraryCounts } from '@/entities/library';
import type { LibraryActions } from '../model/library-actions';
import { useIsMovedOut } from '../model/library-moves';
import { useHistoryList } from '../model/library-queries';
import { groupByMonth, matchesQuery, type HistoryRow } from '../model/history-months';
import { TYPE_FILTERS, matchesType, type TypeFilter } from '../model/plan-order';
import { LibraryRow } from './library-row';
import { EmptyList, ListFailure, RowsSkeleton, SectionTitle } from './list-states';
import { RatingPicker } from './rating-picker';
import { RowMenu } from './row-menu';

const ROWS_PER_STEP = 40;

function monthTitle(key: string, locale: Locale): string {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const isThisYear = year === new Date().getFullYear();
  const title = new Intl.DateTimeFormat(locale, {
    month: 'long',
    ...(isThisYear ? {} : { year: 'numeric' }),
  }).format(date);
  return title.charAt(0).toLocaleUpperCase(locale) + title.slice(1);
}

function HistoryRowItem({ row, actions }: { row: HistoryRow; actions: LibraryActions }) {
  const { dict, locale } = useTranslation();
  const [isRating, setIsRating] = useState(false);
  const watchedOn = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(
    new Date(row.watchedAt),
  );
  const meta = [
    dict.media.type[row.title.type],
    interpolate(dict.my.history.watchedOn, { date: watchedOn }),
  ].join(' · ');

  return (
    <LibraryRow
      title={row.title}
      meta={meta}
      action={
        <RatingPicker
          title={row.title}
          rating={row.rating}
          isOpen={isRating}
          onOpenChange={setIsRating}
          onRate={(rating) => actions.rate(row.title, rating, row.rating)}
        />
      }
      menu={
        <RowMenu
          label={interpolate(dict.my.actions.more, { title: row.title.title })}
          items={[
            { id: 'rate', label: dict.my.actions.changeRating, onAction: () => setIsRating(true) },
            {
              id: 'open',
              label: dict.my.actions.open,
              href: mediaRoute(row.title.type, row.title.slug),
            },
          ]}
        />
      }
    />
  );
}

export function HistoryList({ actions }: { actions: LibraryActions }) {
  const { dict, locale } = useTranslation();
  const isMovedOut = useIsMovedOut();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [shownCount, setShownCount] = useState(ROWS_PER_STEP);
  const history = useHistoryList();
  const counts = useLibraryCounts();

  if (history.isPending) return <RowsSkeleton />;
  if (history.isError) return <ListFailure onRetry={() => void history.refetch()} />;
  if (history.data.length === 0) {
    return <EmptyList {...dict.my.history.empty} href={IMPORT_ROUTE} />;
  }

  const visible = history.data.filter(
    (row) =>
      !isMovedOut(row.title.mediaItemId, 'history') &&
      matchesType(row.title.type, filter) &&
      matchesQuery(row, query),
  );
  const total = counts?.completed ?? history.data.length;
  const shown = visible.slice(0, shownCount);
  const monthTotals = new Map(groupByMonth(visible).map((month) => [month.key, month.rows.length]));

  return (
    <div className="flex flex-col gap-3">
      <SearchField
        aria-label={dict.my.history.searchLabel}
        value={query}
        onChange={(next) => {
          setQuery(next);
          setShownCount(ROWS_PER_STEP);
        }}
        variant="secondary"
        fullWidth
      >
        <SearchField.Group className="h-12">
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={dict.my.history.search} />
          <SearchField.ClearButton className="phone-tap-target" />
        </SearchField.Group>
      </SearchField>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted tabular-nums">
          {interpolate(pluralize(total, dict.my.history.summary, locale), { count: total })}
        </p>
        <SegmentedFilter
          label={dict.my.plan.filterLabel}
          options={TYPE_FILTERS.map((id) => ({ id, label: dict.my.plan.filter[id] }))}
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setShownCount(ROWS_PER_STEP);
          }}
          className="px-0"
        />
      </div>
      {visible.length === 0 ? (
        <p role="status" className="py-8 text-center text-muted">
          {interpolate(dict.my.history.noMatches, { query })}
        </p>
      ) : (
        groupByMonth(shown).map((month) => (
          <section key={month.key} aria-labelledby={`month-${month.key}`}>
            <SectionTitle id={`month-${month.key}`}>
              {monthTitle(month.key, locale)}
              <span className="text-sm font-semibold text-muted tabular-nums">
                {monthTotals.get(month.key)}
              </span>
            </SectionTitle>
            <ul className="flex flex-col">
              {month.rows.map((row) => (
                <li key={row.title.mediaItemId}>
                  <HistoryRowItem row={row} actions={actions} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {visible.length > shown.length ? (
        <Button
          variant="secondary"
          className="min-h-tap self-center"
          onPress={() => setShownCount((count) => count + ROWS_PER_STEP)}
        >
          {dict.my.loadMore}
        </Button>
      ) : null}
    </div>
  );
}
