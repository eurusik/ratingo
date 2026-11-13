'use client';

import { Suspense, use, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import { useTranslation } from '@/shared/i18n';
import { findBrowseCategory, type BrowseCategory } from '../model/browse-category';
import { useCountLabel } from '../model/browse-labels';
import {
  activeFilterCount,
  sortsFor,
  type BrowseFilters,
  type BrowseSort,
  type BrowseState,
} from '../model/browse-state';
import type { FirstPageResult } from '../model/first-page';
import { useBrowseNavigation } from '../model/use-browse-navigation';
import { yearPresets, type YearPreset } from '../model/year-presets';
import { ActiveFilters } from './active-filters';
import { BackToTop } from './back-to-top';
import { BrowseGridSkeleton } from './browse-grid';
import { BrowseLayout } from './browse-layout';
import { PoolNav, TypeSwitch } from './browse-nav';
import { BrowseResults } from './browse-results';
import { EmptyResults } from './empty-results';
import { FiltersDialog } from './filters-dialog';
import { FiltersPanel } from './filters-panel';
import { SortMenu } from './sort-menu';

function FirstPageError() {
  const { dict } = useTranslation();
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-sm">
      <meta name="robots" content="noindex" />
      <p className="text-muted">{dict.browse.list.firstFailed}</p>
      <Button
        variant="secondary"
        size="sm"
        isPending={isRetrying}
        onPress={() => startRetry(() => router.refresh())}
      >
        {dict.browse.list.retry}
      </Button>
    </div>
  );
}

interface ResultsSummaryProps {
  category: BrowseCategory;
  state: BrowseState;
  firstPage: Promise<FirstPageResult>;
}

function ResultsSummary({ category, state, firstPage }: ResultsSummaryProps) {
  const { dict } = useTranslation();
  const countLabel = useCountLabel(category.type);
  const result = use(firstPage);
  const caption = dict.browse.pools[category.pool].caption;
  const showsCount = activeFilterCount(state.filters) > 0 && result.status === 'loaded';

  return <>{showsCount ? countLabel(result.page.total) : caption}</>;
}

interface ResultsBodyProps {
  category: BrowseCategory;
  state: BrowseState;
  title: string;
  firstPage: Promise<FirstPageResult>;
  yearPresets: readonly YearPreset[];
  onChangeFilters: (next: BrowseFilters) => void;
}

function ResultsBody({
  category,
  state,
  title,
  firstPage,
  yearPresets,
  onChangeFilters,
}: ResultsBodyProps) {
  const result = use(firstPage);
  if (result.status === 'failed') return <FirstPageError />;

  if (result.page.total === 0) {
    return (
      <EmptyResults
        category={category}
        state={state}
        yearPresets={yearPresets}
        onChangeFilters={onChangeFilters}
      />
    );
  }

  return (
    <BrowseResults category={category} state={state} title={title} initialPage={result.page} />
  );
}

interface BrowseViewProps {
  category: BrowseCategory;
  state: BrowseState;
  currentYear: number;
  firstPage: Promise<FirstPageResult>;
}

export function BrowseView({ category, state, currentYear, firstPage }: BrowseViewProps) {
  const { dict } = useTranslation();
  const navigation = useBrowseNavigation({ slug: category.slug, state });
  const shownCategory = findBrowseCategory(navigation.shown.slug) ?? category;
  const shownState = navigation.shown.state;
  const isPending = navigation.isPending;
  const presets = yearPresets(currentYear);
  const title = dict.browse.categories[category.slug].title;

  const changeFilters = (filters: BrowseFilters) => navigation.apply({ ...shownState, filters });
  const changeSort = (sort: BrowseSort) => navigation.apply({ ...shownState, sort });

  return (
    <div className="flex flex-col pb-10">
      <BrowseLayout
        heading={<h1 className="sr-only">{`${dict.browse.title}: ${title}`}</h1>}
        typeSwitch={
          <TypeSwitch category={shownCategory} state={shownState} onOpen={navigation.open} />
        }
        pools={<PoolNav category={shownCategory} state={shownState} onOpen={navigation.open} />}
        filtersButton={
          category.isFilterable ? (
            <FiltersDialog
              category={category}
              state={shownState}
              loadedState={state}
              firstPage={firstPage}
              yearPresets={presets}
              onApply={changeFilters}
            />
          ) : undefined
        }
        filtersPanel={
          category.isFilterable ? (
            <FiltersPanel
              category={category}
              filters={shownState.filters}
              yearPresets={presets}
              onChange={changeFilters}
            />
          ) : undefined
        }
        summary={
          <p
            aria-live="polite"
            className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug text-muted"
          >
            <Suspense fallback={dict.browse.pools[category.pool].caption}>
              <ResultsSummary category={category} state={state} firstPage={firstPage} />
            </Suspense>
          </p>
        }
        sort={
          <SortMenu options={sortsFor(category)} value={shownState.sort} onChange={changeSort} />
        }
        results={
          <>
            <ActiveFilters
              filters={shownState.filters}
              yearPresets={presets}
              onChange={changeFilters}
            />
            <Suspense fallback={<BrowseGridSkeleton hasSidebar={category.isFilterable} />}>
              <ResultsBody
                category={category}
                state={state}
                title={title}
                firstPage={firstPage}
                yearPresets={presets}
                onChangeFilters={changeFilters}
              />
            </Suspense>
          </>
        }
        resultsLabel={title}
        isBusy={isPending}
      />
      <BackToTop />
    </div>
  );
}
