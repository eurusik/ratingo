/**
 * Saved page - user's personal library.
 * Contains tabs: For Later, Considering, Notifications.
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useAuth } from '@/core/auth';
import { SavedList, SubscriptionsList } from '@/modules/saved';

const TAB_VALUES = {
  FOR_LATER: 'for-later',
  CONSIDERING: 'considering',
  NOTIFICATIONS: 'notifications',
} as const;

type TabValue = (typeof TAB_VALUES)[keyof typeof TAB_VALUES];

const DEFAULT_TAB = TAB_VALUES.FOR_LATER;

function getTabFromParam(param: string | null): TabValue {
  if (param === TAB_VALUES.NOTIFICATIONS) return TAB_VALUES.NOTIFICATIONS;
  if (param === TAB_VALUES.CONSIDERING) return TAB_VALUES.CONSIDERING;
  return DEFAULT_TAB;
}

function SavedPageContent() {
  const { dict } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  
  const defaultTab = getTabFromParam(searchParams.get('tab'));

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse mb-8" />
          <div className="h-10 w-96 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h1 className="text-2xl font-bold text-zinc-100 mb-4">
              {dict.saved.title}
            </h1>
            <p className="text-zinc-500">
              {dict.auth.loginSubtitle}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl font-bold text-zinc-100 mb-8">
          {dict.saved.title}
        </h1>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="bg-zinc-900 border border-zinc-800 mb-6">
            <TabsTrigger 
              value={TAB_VALUES.FOR_LATER}
              className="data-[state=active]:bg-zinc-800"
            >
              {dict.saved.tabs.forLater}
            </TabsTrigger>
            <TabsTrigger 
              value={TAB_VALUES.CONSIDERING}
              className="data-[state=active]:bg-zinc-800"
            >
              {dict.saved.tabs.considering}
            </TabsTrigger>
            <TabsTrigger 
              value={TAB_VALUES.NOTIFICATIONS}
              className="data-[state=active]:bg-zinc-800"
            >
              {dict.saved.tabs.notifications}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={TAB_VALUES.FOR_LATER} className="mt-0">
            <SavedList list="for_later" />
          </TabsContent>

          <TabsContent value={TAB_VALUES.CONSIDERING} className="mt-0">
            <SavedList list="considering" />
          </TabsContent>

          <TabsContent value={TAB_VALUES.NOTIFICATIONS} className="mt-0">
            <SubscriptionsList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function SavedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse mb-8" />
        </div>
      </div>
    }>
      <SavedPageContent />
    </Suspense>
  );
}
