/**
 * Activity page - user's watching progress.
 * Contains tabs: Watching, Caught Up, Paused, Dropped, History.
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, type MouseEvent } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent, Badge } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useAuth } from '@/core/auth';
import {
  Watchlist,
  HistoryList,
  PausedList,
  CaughtUpList,
  DroppedList,
  FavoriteUpdates,
  ActivityEpisodeSheet,
  useListCounts,
} from '@/modules/saved';
import { USER_MEDIA_STATE } from '@/core/api';

/**
 * Tab identifiers for URL params and Radix UI.
 */
const TAB_VALUES = {
  WATCHING: USER_MEDIA_STATE.WATCHING,
  CAUGHT_UP: USER_MEDIA_STATE.CAUGHT_UP,
  PAUSED: USER_MEDIA_STATE.PAUSED,
  DROPPED: USER_MEDIA_STATE.DROPPED,
  HISTORY: 'history',
} as const;

type TabValue = (typeof TAB_VALUES)[keyof typeof TAB_VALUES];

const DEFAULT_TAB = TAB_VALUES.WATCHING;

function getTabFromParam(param: string | null): TabValue {
  if (param === TAB_VALUES.CAUGHT_UP) return TAB_VALUES.CAUGHT_UP;
  if (param === TAB_VALUES.PAUSED) return TAB_VALUES.PAUSED;
  if (param === TAB_VALUES.DROPPED) return TAB_VALUES.DROPPED;
  if (param === TAB_VALUES.HISTORY) return TAB_VALUES.HISTORY;
  return DEFAULT_TAB;
}

function ActivityPageContent() {
  const { dict } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();

  const defaultTab = getTabFromParam(searchParams.get('tab'));

  const handleTabClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const trigger = (e.target as HTMLElement).closest('[role="tab"]');
    if (trigger) {
      trigger.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, []);

  const countsQuery = useListCounts(isAuthenticated);
  const {
    watching: watchingTotal = 0,
    caughtUp: caughtUpTotal = 0,
    paused: pausedTotal = 0,
    dropped: droppedTotal = 0,
    completed: historyTotal = 0,
  } = (countsQuery.data as {
    watching?: number;
    caughtUp?: number;
    paused?: number;
    dropped?: number;
    completed?: number;
  }) ?? {};

  if (isLoading) {
    return (
      <div className="min-h-screen pt-6 md:pt-12 pb-12">
        <div className="container mx-auto px-4">
          <div className="h-8 w-48 bg-cinema-elevated rounded animate-pulse mb-8" />
          <div className="h-10 w-96 bg-cinema-elevated rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-6 md:pt-12 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h1 className="text-2xl font-bold text-cinema-text-primary mb-4">{dict.activity.title}</h1>
            <p className="text-cinema-text-muted">{dict.auth.loginSubtitle}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-6 md:pt-12 pb-12">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl font-bold text-cinema-text-primary mb-4 md:mb-8">{dict.activity.title}</h1>

        <Tabs defaultValue={defaultTab} className="w-full">
          <div className="overflow-x-auto scrollbar-none mb-4 md:mb-6" onClick={handleTabClick}>
            <TabsList className="bg-cinema-card border border-cinema-borderSoft h-auto gap-0.5 md:gap-1 p-1 md:w-auto w-max">
              <TabsTrigger value={TAB_VALUES.WATCHING} className="px-2.5 md:px-3 text-[13px] md:text-sm whitespace-nowrap gap-1.5 data-[state=active]:bg-cinema-elevated data-[state=inactive]:hover:bg-cinema-elevated/50">
                {dict.activity.tabs.watching}
                {watchingTotal > 0 && <Badge as="span" variant="count">{watchingTotal}</Badge>}
              </TabsTrigger>
              <TabsTrigger value={TAB_VALUES.CAUGHT_UP} className="px-2.5 md:px-3 text-[13px] md:text-sm whitespace-nowrap gap-1.5 data-[state=active]:bg-cinema-elevated data-[state=inactive]:hover:bg-cinema-elevated/50">
                {dict.activity.tabs.caughtUp}
                {caughtUpTotal > 0 && <Badge as="span" variant="count">{caughtUpTotal}</Badge>}
              </TabsTrigger>
              <TabsTrigger value={TAB_VALUES.PAUSED} className="px-2.5 md:px-3 text-[13px] md:text-sm whitespace-nowrap gap-1.5 data-[state=active]:bg-cinema-elevated data-[state=inactive]:hover:bg-cinema-elevated/50">
                {dict.activity.tabs.paused}
                {pausedTotal > 0 && <Badge as="span" variant="count">{pausedTotal}</Badge>}
              </TabsTrigger>
              <TabsTrigger value={TAB_VALUES.DROPPED} className="px-2.5 md:px-3 text-[13px] md:text-sm whitespace-nowrap gap-1.5 data-[state=active]:bg-cinema-elevated data-[state=inactive]:hover:bg-cinema-elevated/50">
                {dict.activity.tabs.dropped}
                {droppedTotal > 0 && <Badge as="span" variant="count">{droppedTotal}</Badge>}
              </TabsTrigger>
              <TabsTrigger value={TAB_VALUES.HISTORY} className="px-2.5 md:px-3 text-[13px] md:text-sm whitespace-nowrap gap-1.5 data-[state=active]:bg-cinema-elevated data-[state=inactive]:hover:bg-cinema-elevated/50">
                {dict.activity.tabs.history}
                {historyTotal > 0 && <Badge as="span" variant="count">{historyTotal}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={TAB_VALUES.WATCHING} className="mt-0">
            <Watchlist totalAcrossTypes={watchingTotal} />
            <FavoriteUpdates />
          </TabsContent>

          <TabsContent value={TAB_VALUES.CAUGHT_UP} className="mt-0">
            <CaughtUpList totalAcrossTypes={caughtUpTotal} />
          </TabsContent>

          <TabsContent value={TAB_VALUES.PAUSED} className="mt-0">
            <PausedList totalAcrossTypes={pausedTotal} />
          </TabsContent>

          <TabsContent value={TAB_VALUES.DROPPED} className="mt-0">
            <DroppedList totalAcrossTypes={droppedTotal} />
          </TabsContent>

          <TabsContent value={TAB_VALUES.HISTORY} className="mt-0">
            <HistoryList totalAcrossTypes={historyTotal} />
          </TabsContent>
        </Tabs>

        <ActivityEpisodeSheet />
      </div>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-6 md:pt-12 pb-12">
          <div className="container mx-auto px-4">
            <div className="h-8 w-48 bg-cinema-elevated rounded animate-pulse mb-8" />
          </div>
        </div>
      }
    >
      <ActivityPageContent />
    </Suspense>
  );
}
