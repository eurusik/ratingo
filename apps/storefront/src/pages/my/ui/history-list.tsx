'use client';

import { useState } from 'react';
import { SearchField } from '@heroui/react';
import { pluralize } from '@ratingo/web-core/lib';
import { IMPORT_ROUTE, mediaRoute } from '@/shared/config';
import { interpolate, useTranslation, type Locale } from '@/shared/i18n';
import { EmptyState, SegmentedFilter, ShowMore } from '@/shared/ui';
import { useLibraryCounts } from '@/entities/library';
import type { LibraryActions } from '../model/library-actions';
import { useIsMovedOut } from '../model/library-moves';
import { useHistoryPages, useHistorySearch } from '../model/library-queries';
import { useRevealedRows } from '../model/revealed-rows';
import { groupByMonth, matchesQuery, type HistoryRow } from '../model/history-months';
import { TYPE_FILTERS, matchesType, type TypeFilter } from '../model/plan-order';
import { LibraryRow } from './library-row';
import { EmptyList, ListFailure, RowsSkeleton, SectionTitle } from './list-states';
import { RatingPicker } from './rating-picker';
import { RowMenu } from './row-menu';

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

function useHistoryRows(filter: TypeFilter, query: string) {
  const isMovedOut = useIsMovedOut();
  const isSearching = query.trim() !== '';
  const pages = useHistoryPages(filter === 'all' ? undefined : filter);
  const search = useHistorySearch(isSearching);
  const source = isSearching
    ? (search.data ?? []).filter(
        (row) => matchesType(row.title.type, filter) && matchesQuery(row, query),
      )
    : (pages.data?.pages.flatMap((page) => page.rows) ?? []);
  const rows = source.filter((row) => !isMovedOut(row.title.mediaItemId, 'history'));
  const reveal = useRevealedRows(rows, `${filter}:${query}`);

  return {
    isSearching,
    pages,
    search,
    rows: isSearching ? reveal.shown : rows,
    more: isSearching
      ? {
          hasMore: reveal.hasMore,
          isLoading: false,
          rearmKey: reveal.shownCount,
          onMore: reveal.showMore,
        }
      : {
          hasMore: pages.hasNextPage,
          isLoading: pages.isFetchingNextPage,
          rearmKey: pages.data?.pages.length ?? 0,
          onMore: () => void pages.fetchNextPage({ cancelRefetch: false }),
        },
  };
}

export function HistoryList({ actions }: { actions: LibraryActions }) {
  const { dict, locale } = useTranslation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TypeFilter>('all');
  const counts = useLibraryCounts();
  const history = useHistoryRows(filter, query);
  const { pages, search } = history;

  if (pages.isPending) return <RowsSkeleton />;
  if (pages.isError) return <ListFailure onRetry={() => void pages.refetch()} />;
  if (filter === 'all' && !history.isSearching && history.rows.length === 0) {
    return <EmptyList {...dict.my.history.empty} href={IMPORT_ROUTE} />;
  }

  const total = counts?.completed ?? history.rows.length;
  const months = groupByMonth(history.rows);
  const lastMonth = months.at(-1)?.key;
  const renderResults = () => {
    if (history.isSearching && search.isPending) return <RowsSkeleton />;
    if (history.isSearching && search.isError) {
      return <ListFailure onRetry={() => void search.refetch()} />;
    }
    if (history.rows.length === 0) {
      return (
        <EmptyState
          title={interpolate(dict.my.history.noMatches, { query })}
          text={dict.my.history.noMatchesText}
        />
      );
    }
    return months.map((month) => (
      <section key={month.key} aria-labelledby={`month-${month.key}`}>
        <SectionTitle id={`month-${month.key}`}>
          {monthTitle(month.key, locale)}
          {month.key === lastMonth && history.more.hasMore ? null : (
            <span className="text-sm font-semibold text-muted tabular-nums">
              {month.rows.length}
            </span>
          )}
        </SectionTitle>
        <ul className="flex flex-col">
          {month.rows.map((row) => (
            <li key={row.title.mediaItemId}>
              <HistoryRowItem row={row} actions={actions} />
            </li>
          ))}
        </ul>
      </section>
    ));
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <SearchField
        aria-label={dict.my.history.searchLabel}
        value={query}
        onChange={setQuery}
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
        <p className="text-sm text-muted tabular-nums md:hidden">
          {interpolate(pluralize(total, dict.my.history.summary, locale), { count: total })}
        </p>
        <SegmentedFilter
          label={dict.my.plan.filterLabel}
          options={TYPE_FILTERS.map((id) => ({ id, label: dict.my.plan.filter[id] }))}
          value={filter}
          onChange={setFilter}
          className="px-0"
        />
      </div>
      {renderResults()}
      <ShowMore
        key={`${filter}:${query}`}
        hasMore={history.more.hasMore}
        isLoading={history.more.isLoading}
        label={dict.my.loadMore}
        loadingLabel={dict.common.loading}
        rearmKey={history.more.rearmKey}
        onMore={history.more.onMore}
      />
    </div>
  );
}
