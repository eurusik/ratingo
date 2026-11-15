'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Dropdown, Label, type Key } from '@heroui/react';
import { ArrowUpDown } from 'lucide-react';
import { ScoreChip } from '@/entities/media';
import { BROWSE_ROUTE, mediaRoute, showPickRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useClientNow } from '@/shared/lib';
import { SegmentedFilter } from '@/shared/ui';
import type { LibraryActions } from '../model/library-actions';
import { useLibraryMoves } from '../model/library-moves';
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
import { EmptyList, ListFailure, RowsSkeleton } from './list-states';
import { RowMenu, type RowMenuItem } from './row-menu';

function SortMenu({ sort, onSort }: { sort: PlanSort; onSort: (sort: PlanSort) => void }) {
  const { dict } = useTranslation();
  const label = dict.my.plan.sort[sort];

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={interpolate(dict.my.plan.sortLabel, { sort: label })}
        className="flex min-h-tap shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-foreground outline-none hover:bg-default focus-visible:outline-2 focus-visible:outline-focus"
      >
        <ArrowUpDown aria-hidden className="size-4 text-muted" />
        <span className="max-w-32 truncate md:max-w-none">{label}</span>
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

function PlanRowItem({ row, actions }: { row: PlanRow; actions: LibraryActions }) {
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
            size="sm"
            variant="secondary"
            aria-label={interpolate(dict.my.plan.startLabel, { title: title.title })}
            onPress={() => actions.start(row)}
            className="phone-tap-target shrink-0 rounded-full font-bold"
          >
            {dict.my.plan.start}
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
  const moves = useLibraryMoves();
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<PlanSort>('recent');
  const plan = usePlanList();

  if (plan.isPending) return <RowsSkeleton />;
  if (plan.isError) return <ListFailure onRetry={() => void plan.refetch()} />;

  const rows = orderPlan(
    plan.data.filter((row) => !moves.isMovedOut(row.title.mediaItemId, 'plan')),
    { sort, filter, now },
  );
  if (plan.data.length === 0) return <EmptyList {...dict.my.plan.empty} href={BROWSE_ROUTE} />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SegmentedFilter
          label={dict.my.plan.filterLabel}
          options={TYPE_FILTERS.map((id) => ({ id, label: dict.my.plan.filter[id] }))}
          value={filter}
          onChange={setFilter}
          className="min-w-0 flex-1 px-0"
        />
        <SortMenu sort={sort} onSort={setSort} />
      </div>
      <ul aria-label={dict.my.lists.plan} className="flex flex-col">
        {rows.map((row) => (
          <li key={row.title.mediaItemId}>
            <PlanRowItem row={row} actions={actions} />
          </li>
        ))}
      </ul>
    </div>
  );
}
