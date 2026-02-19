/**
 * Activity page - user's watching progress.
 * Contains tabs: Watching, Paused, Completed (history).
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useAuth } from '@/core/auth';
import { Watchlist, HistoryList, PausedList, DroppedList, FavoriteUpdates } from '@/modules/saved';
import { USER_MEDIA_STATE } from '@/core/api';

/**
 * Tab identifiers for URL params and Radix UI.
 * WATCHING and PAUSED use USER_MEDIA_STATE for consistency.
 * HISTORY is a UI concept (shows completed items).
 */
const TAB_VALUES = {
  WATCHING: USER_MEDIA_STATE.WATCHING,
  PAUSED: USER_MEDIA_STATE.PAUSED,
  DROPPED: USER_MEDIA_STATE.DROPPED,
  HISTORY: 'history',
} as const;

type TabValue = (typeof TAB_VALUES)[keyof typeof TAB_VALUES];

const DEFAULT_TAB = TAB_VALUES.WATCHING;

function getTabFromParam(param: string | null): TabValue {
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

  if (isLoading) {
    return (
      <div className="min-h-screen pt-8 md:pt-24 pb-6 md:pb-12">
        <div className="container mx-auto px-4">
          <div className="h-8 w-48 bg-cinema-elevated rounded animate-pulse mb-8" />
          <div className="h-10 w-96 bg-cinema-elevated rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-8 md:pt-24 pb-6 md:pb-12">
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
    <div className="min-h-screen pt-8 md:pt-24 pb-6 md:pb-12">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl font-bold text-cinema-text-primary mb-8">{dict.activity.title}</h1>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="bg-cinema-card border border-cinema-borderSoft mb-6 h-auto gap-1 p-1 overflow-x-auto flex-nowrap scrollbar-hide">
            <TabsTrigger value={TAB_VALUES.WATCHING} className="data-[state=active]:bg-cinema-elevated">
              {dict.activity.tabs.watching}
            </TabsTrigger>
            <TabsTrigger value={TAB_VALUES.PAUSED} className="data-[state=active]:bg-cinema-elevated">
              {dict.activity.tabs.paused}
            </TabsTrigger>
            <TabsTrigger value={TAB_VALUES.DROPPED} className="data-[state=active]:bg-cinema-elevated">
              {dict.activity.tabs.dropped}
            </TabsTrigger>
            <TabsTrigger value={TAB_VALUES.HISTORY} className="data-[state=active]:bg-cinema-elevated">
              {dict.activity.tabs.history}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={TAB_VALUES.WATCHING} className="mt-0">
            <Watchlist />
            <FavoriteUpdates />
          </TabsContent>

          <TabsContent value={TAB_VALUES.PAUSED} className="mt-0">
            <PausedList />
          </TabsContent>

          <TabsContent value={TAB_VALUES.DROPPED} className="mt-0">
            <DroppedList />
          </TabsContent>

          <TabsContent value={TAB_VALUES.HISTORY} className="mt-0">
            <HistoryList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-8 md:pt-24 pb-6 md:pb-12">
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
