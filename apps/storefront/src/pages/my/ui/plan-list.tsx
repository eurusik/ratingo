'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Dropdown, Label, type Key } from '@heroui/react';
import { ArrowUpDown, Play } from 'lucide-react';
import { ScoreChip } from '@/entities/media';
import { BROWSE_ROUTE, mediaRoute, showPickRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { isSearchQuery, matchesSearch, useClientNow, useRevealedRows } from '@/shared/lib';
import { EmptyState, FadingScrollRow, ListSearch, SegmentedFilter, ShowMore } from '@/shared/ui';
import type { LibraryActions } from '../model/library-actions';
import { useIsMovedOut } from '../model/library-moves';
import { usePlanList } from '../model/library-queries';
import {
  PLAN_SORTS,
  TYPE_FILTERS,
  orderPlan,
  type PlanRow,
  type PlanSort,
  type TypeFilter,
} from '../model/plan-order';
import { CheckButton } from './check-button';
import { LibraryRow } from './library-row';
import { EmptyList, LibraryListSkeleton, ListFailure } from './list-states';
import { RowMenu, type RowMenuItem } from './row-menu';

const EAGER_ROWS = 3;

const SELECTED_FILTER = '[aria-checked="true"]';

function SortMenu({ sort, onSort }: { sort: PlanSort; onSort: (sort: PlanSort) => void }) {
  const { dict } = useTranslation();
  const label = dict.my.plan.sort[sort];

  return (
    <Dropdown>
      <Dropdown.Trigger className="flex min-h-tap shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-foreground outline-none hover:bg-default focus-visible:outline-2 focus-visible:outline-focus">
        <ArrowUpDown aria-hidden className="size-4 text-muted" />
        <span className="sr-only">{dict.my.plan.sortPrefix}</span>
        <span>{label}</span>
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label={interpolate(dict.my.plan.sortLabel, { sort: label })}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[sort]}
          onAction={(key: Key) => {
            const next = PLAN_SORTS.find((option) => option === key);
            if (next) onSort(next);
          }}
        >
          {PLAN_SORTS.map((option) => (
            <Dropdown.Item key={option} id={option} textValue={dict.my.plan.sort[option]}>
              <Label>{dict.my.plan.sort[option]}</Label>
              <Dropdown.ItemIndicator />
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function PlanRowItem({
  row,
  actions,
  isEager,
}: {
  row: PlanRow;
  actions: LibraryActions;
  isEager: boolean;
}) {
  const { dict } = useTranslation();
  const { title } = row;
  const href = mediaRoute(title.type, title.slug);
  const isMovie = title.type === 'movie';
  const typeLabel = dict.media.type[title.type];
  const meta = [typeLabel, title.year].filter(Boolean).join(' · ');
  const menuItems: RowMenuItem[] = [
    ...(isMovie
      ? []
      : [{ id: 'pick', label: dict.my.actions.watchedUntil, href: showPickRoute(title.slug) }]),
    { id: 'open', label: dict.my.actions.open, href },
    {
      id: 'remove',
      label: dict.my.actions.remove,
      isDanger: true,
      onAction: () => actions.removeFromPlan(row),
    },
  ];

  const rateLink = (
    <Link href={href} className="text-sm font-semibold text-accent no-underline">
      {dict.my.toast.rate}
    </Link>
  );

  return (
    <LibraryRow
      title={title}
      isEager={isEager}
      meta={
        <>
          {title.score !== undefined ? <ScoreChip score={title.score} /> : null}
          <span className="truncate">{meta}</span>
        </>
      }
      action={
        isMovie ? (
          <CheckButton
            label={interpolate(dict.my.actions.markMovie, { title: title.title })}
            onCheck={() => actions.markMovieWatched(row, rateLink)}
          />
        ) : (
          <Button
            variant="secondary"
            aria-label={interpolate(dict.my.plan.startLabel, { title: title.title })}
            onPress={() => actions.start(row)}
            className="size-11 shrink-0 gap-2 rounded-full p-0 font-bold md:w-auto md:px-4"
          >
            <Play aria-hidden className="size-4.5" />
            <span className="max-md:sr-only">{dict.my.plan.start}</span>
          </Button>
        )
      }
      menu={
        <RowMenu
          label={interpolate(dict.my.actions.more, { title: title.title })}
          items={menuItems}
        />
      }
    />
  );
}

export function PlanList({ actions }: { actions: LibraryActions }) {
  const { dict } = useTranslation();
  const now = useClientNow();
  const isMovedOut = useIsMovedOut();
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<PlanSort>('recent');
  const [query, setQuery] = useState('');
  const plan = usePlanList();
  const rows = orderPlan(
    (plan.data ?? []).filter(
      (row) => !isMovedOut(row.title.mediaItemId, 'plan') && matchesSearch(row.title.title, query),
    ),
    { sort, filter, now },
  );
  const resetKey = `${filter}:${sort}:${query}`;
  const reveal = useRevealedRows(rows, resetKey);

  if (plan.isPending) return <LibraryListSkeleton list="plan" />;
  if (plan.isError) return <ListFailure onRetry={() => void plan.refetch()} isRetrying={plan.isFetching} />;

  if (plan.data.length === 0) return <EmptyList {...dict.my.plan.empty} href={BROWSE_ROUTE} />;

  const noMatches = isSearchQuery(query)
    ? {
        title: interpolate(dict.my.search.noMatches, { query }),
        text: dict.my.search.noMatchesText,
      }
    : { title: dict.my.plan.noMatches, text: dict.my.plan.noMatchesText };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <ListSearch
        label={dict.my.plan.searchLabel}
        placeholder={dict.my.plan.search}
        value={query}
        onChange={setQuery}
      />
      <FadingScrollRow activeKey={filter} contentKey={sort} activeSelector={SELECTED_FILTER}>
        <div className="flex w-max items-center gap-2 md:w-full md:justify-between">
          <SegmentedFilter
            label={dict.my.plan.filterLabel}
            options={TYPE_FILTERS.map((id) => ({ id, label: dict.my.plan.filter[id] }))}
            value={filter}
            onChange={setFilter}
            className="shrink-0 px-0"
          />
          <SortMenu sort={sort} onSort={setSort} />
        </div>
      </FadingScrollRow>
      {rows.length === 0 ? <EmptyState {...noMatches} /> : null}
      <ul aria-label={dict.my.lists.plan} className="flex flex-col">
        {reveal.shown.map((row, index) => (
          <li key={row.title.mediaItemId}>
            <PlanRowItem row={row} actions={actions} isEager={index < EAGER_ROWS} />
          </li>
        ))}
      </ul>
      <ShowMore
        key={resetKey}
        hasMore={reveal.hasMore}
        label={dict.my.loadMore}
        loadingLabel={dict.common.loading}
        rearmKey={reveal.shownCount}
        onMore={reveal.showMore}
      />
    </div>
  );
}
