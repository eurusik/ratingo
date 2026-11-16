'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Skeleton } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { Check } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { LIST_ROW_FRAME } from '@/shared/ui';
import type { MediaImportResult } from '@/shared/api';
import {
  showEpisodesQuery,
  useImportedShowWatching,
  type WatchMark,
} from '@/pages/settings/model/import/imported-show-watching';
import { useRatedImportedShows, type RatedShow } from '@/pages/settings/model/import/rated-shows';
import { formatOwnRating } from '@/pages/settings/lib/import/rating-label';
import { CARD_LIST } from '../settings-card';
import { WatchSheet, preloadEpisodesSheet } from './watch-sheet';

const COLLAPSED_SHOWS = 3;

function useShowMeta() {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import.shows;
  return (show: RatedShow, mark: WatchMark | undefined) => {
    if (mark?.kind === 'stoppedAt') return interpolate(copy.stoppedAt, { code: mark.code });
    if (mark?.kind === 'caughtUp') return copy.caughtUp;
    if (mark) return copy.notStarted;
    if (show.score === undefined) return copy.unrated;
    return interpolate(copy.rated, { score: formatOwnRating(locale, show.score) });
  };
}

interface ShowCardProps {
  show: RatedShow;
  mark?: WatchMark;
  isDesktop: boolean;
  isBusy: boolean;
  onToggle: () => void;
}

function useSheetPreload(slug: string) {
  const queryClient = useQueryClient();
  return () => {
    preloadEpisodesSheet();
    void queryClient.prefetchQuery(showEpisodesQuery(slug));
  };
}

function ShowCard({ show, mark, isDesktop, isBusy, onToggle }: ShowCardProps) {
  const { dict } = useTranslation();
  const preload = useSheetPreload(show.slug);
  const copy = dict.settings.import.shows;
  const meta = useShowMeta()(show, mark);
  const isWatching = mark !== undefined;

  return (
    <li
      className={cn(
        'flex items-center gap-3 py-2.5',
        isDesktop && 'flex-col items-stretch gap-2.5 rounded-2xl bg-surface p-3',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'relative shrink-0 overflow-hidden rounded-[10px] bg-default',
          isDesktop ? 'h-[81px] w-full rounded-xl' : LIST_ROW_FRAME,
        )}
      >
        {show.imageUrl ? (
          <Image
            unoptimized
            src={show.imageUrl}
            alt=""
            width={288}
            height={162}
            className="size-full object-cover object-[center_20%]"
          />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <b className="truncate text-[15px]">{show.title}</b>
          <span className="text-[13px] leading-snug text-muted tabular-nums">{meta}</span>
        </span>
        <Button
          size="sm"
          variant={isWatching ? 'secondary' : 'outline'}
          aria-pressed={isWatching}
          aria-label={interpolate(copy.watchingLabel, { title: show.title })}
          isPending={isBusy}
          onPress={onToggle}
          onHoverStart={mark ? undefined : preload}
          onFocus={mark ? undefined : preload}
          className={cn(
            'h-11 shrink-0 gap-1 rounded-full px-3 font-bold md:h-9',
            isWatching && 'text-accent',
          )}
        >
          {isWatching ? <Check aria-hidden className="size-4" /> : null}
          {copy.watching}
        </Button>
      </span>
    </li>
  );
}

function RatedShowsSkeleton({ isDesktop }: { isDesktop: boolean }) {
  const { dict } = useTranslation();
  const rows = Array.from({ length: COLLAPSED_SHOWS }, (_, index) => index);

  return (
    <div role="status" aria-busy className="flex flex-col gap-2 md:gap-2.5">
      <span className="sr-only">{dict.common.loading}</span>
      <Skeleton className="mx-1 h-4 w-64 rounded-md md:mx-0 md:h-5" />
      {isDesktop ? (
        <div className="grid grid-cols-3 gap-3">
          {rows.map((row) => (
            <div key={row} className="flex flex-col gap-2.5 rounded-2xl bg-surface p-3">
              <Skeleton className="h-[81px] w-full rounded-xl" />
              <span className="flex items-center gap-2.5">
                <span className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </span>
                <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <ul className={CARD_LIST}>
          {rows.map((row) => (
            <li key={row} className="flex items-center gap-3 py-2.5">
              <Skeleton className={cn('shrink-0 rounded-[10px]', LIST_ROW_FRAME)} />
              <span className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </span>
              <Skeleton className="h-11 w-24 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RatedShows({
  result,
  isDesktop,
}: {
  result: MediaImportResult;
  isDesktop: boolean;
}) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.shows;
  const titleId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const ratedShows = useRatedImportedShows(result);
  const shows = ratedShows.data ?? [];
  const watching = useImportedShowWatching();

  if (ratedShows.isLoading) return <RatedShowsSkeleton isDesktop={isDesktop} />;
  if (shows.length === 0) return null;
  const visible = isExpanded ? shows : shows.slice(0, COLLAPSED_SHOWS);
  const canExpand = !isExpanded && shows.length > COLLAPSED_SHOWS;
  const expand = (
    <Button
      variant="ghost"
      onPress={() => setIsExpanded(true)}
      className={cn(
        'min-h-tap rounded-full font-semibold text-accent',
        isDesktop ? 'ms-auto' : 'self-center',
      )}
    >
      {interpolate(copy.showAll, { count: shows.length })}
    </Button>
  );

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2 md:gap-2.5">
      {isDesktop ? (
        <div className="flex items-baseline gap-2.5">
          <h2 id={titleId} className="text-[17px] font-extrabold">
            {copy.deskTitle}
          </h2>
          <span className="min-w-0 flex-1 text-sm text-muted">{copy.deskHint}</span>
          {canExpand ? expand : null}
        </div>
      ) : (
        <h2 id={titleId} className="mx-1 text-[13px] font-bold text-muted">
          {copy.title}
        </h2>
      )}
      <ul className={isDesktop ? 'grid grid-cols-3 gap-3' : CARD_LIST}>
        {visible.map((show) => {
          const mark = watching.marks[show.mediaItemId];
          return (
            <ShowCard
              key={show.mediaItemId}
              show={show}
              mark={mark}
              isDesktop={isDesktop}
              isBusy={watching.isBusy(show.mediaItemId)}
              onToggle={() => (mark ? void watching.unmark(show) : watching.open(show))}
            />
          );
        })}
      </ul>
      {canExpand && !isDesktop ? expand : null}
      {watching.openShow ? (
        <WatchSheet
          key={watching.openShow.mediaItemId}
          show={watching.openShow}
          onMark={(show, mark) => void watching.markWatching(show, mark)}
          onClose={watching.close}
        />
      ) : null}
    </section>
  );
}
