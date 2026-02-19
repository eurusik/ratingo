/**
 * Saved page - user's bookmarks.
 * Contains tabs: For Later, Considering.
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useAuth } from '@/core/auth';
import { SavedList } from '@/modules/saved';

const TAB_VALUES = {
  FOR_LATER: 'for-later',
  CONSIDERING: 'considering',
} as const;

type TabValue = (typeof TAB_VALUES)[keyof typeof TAB_VALUES];

const DEFAULT_TAB = TAB_VALUES.FOR_LATER;

function getTabFromParam(param: string | null): TabValue {
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
          <div className="h-8 w-48 bg-cinema-elevated rounded animate-pulse mb-8" />
          <div className="h-10 w-96 bg-cinema-elevated rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <h1 className="text-2xl font-bold text-cinema-text-primary mb-4">{dict.saved.title}</h1>
            <p className="text-cinema-text-muted">{dict.auth.loginSubtitle}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-4">
        <h1 className="text-2xl font-bold text-cinema-text-primary mb-8">{dict.saved.title}</h1>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="bg-cinema-card border border-cinema-borderSoft mb-6 h-auto gap-1 p-1 overflow-x-auto flex-nowrap scrollbar-hide">
            <TabsTrigger value={TAB_VALUES.FOR_LATER} className="data-[state=active]:bg-cinema-elevated">
              {dict.saved.tabs.forLater}
            </TabsTrigger>
            <TabsTrigger value={TAB_VALUES.CONSIDERING} className="data-[state=active]:bg-cinema-elevated">
              {dict.saved.tabs.considering}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={TAB_VALUES.FOR_LATER} className="mt-0">
            <SavedList list="for_later" />
          </TabsContent>

          <TabsContent value={TAB_VALUES.CONSIDERING} className="mt-0">
            <SavedList list="considering" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function SavedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-24 pb-12">
          <div className="container mx-auto px-4">
            <div className="h-8 w-48 bg-cinema-elevated rounded animate-pulse mb-8" />
          </div>
        </div>
      }
    >
      <SavedPageContent />
    </Suspense>
  );
}
