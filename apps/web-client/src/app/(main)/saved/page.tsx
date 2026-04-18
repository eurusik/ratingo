/**
 * Saved page - user's bookmarks.
 * Contains tabs: For Later, Considering.
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent, Badge } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { useAuth } from '@/core/auth';
import { SavedList, useListCounts } from '@/modules/saved';

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

  const countsQuery = useListCounts(isAuthenticated);
  const { forLater: forLaterTotal = 0, considering: consideringTotal = 0 } =
    countsQuery.data ?? {};

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
          <TabsList className="bg-cinema-card border border-cinema-borderSoft mb-6 h-auto gap-0.5 md:gap-1 p-1 md:w-auto w-full">
            <TabsTrigger value={TAB_VALUES.FOR_LATER} className="flex-1 md:flex-none min-w-0 px-2 md:px-3 text-[13px] md:text-sm gap-1.5 data-[state=active]:bg-cinema-elevated data-[state=inactive]:hover:bg-cinema-elevated/50">
              {dict.saved.tabs.forLater}
              {forLaterTotal > 0 && <Badge as="span" variant="count">{forLaterTotal}</Badge>}
            </TabsTrigger>
            <TabsTrigger value={TAB_VALUES.CONSIDERING} className="flex-1 md:flex-none min-w-0 px-2 md:px-3 text-[13px] md:text-sm gap-1.5 data-[state=active]:bg-cinema-elevated data-[state=inactive]:hover:bg-cinema-elevated/50">
              {dict.saved.tabs.considering}
              {consideringTotal > 0 && <Badge as="span" variant="count">{consideringTotal}</Badge>}
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
