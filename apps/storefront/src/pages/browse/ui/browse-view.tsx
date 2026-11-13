'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';
import type { TrendingMedia } from '@/entities/media';
import type { CatalogPage } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import type { BrowseCategory } from '../model/browse-category';
import {
  activeFilterCount,
  sortsFor,
  type BrowseFilters,
  type BrowseSort,
  type BrowseState,
} from '../model/browse-state';
import { countLabel } from '../model/filter-labels';
import { useBrowseNavigation } from '../model/use-browse-navigation';
import { yearPresets, type YearPreset } from '../model/year-presets';
import { ActiveFilters } from './active-filters';
import { BackToTop } from './back-to-top';
import { PoolNav, TypeTabs } from './browse-nav';
import { BrowseResults } from './browse-results';
import { EmptyResults } from './empty-results';
import { FiltersDialog } from './filters-dialog';
import { FiltersPanel } from './filters-panel';
import { SortMenu } from './sort-menu';

interface ResultsBodyProps {
  category: BrowseCategory;
  state: BrowseState;
  title: string;
  initialPage: CatalogPage<TrendingMedia> | null;
  yearPresets: readonly YearPreset[];
  onChangeFilters: (next: BrowseFilters) => void;
}

function ResultsBody({ initialPage, title, ...props }: ResultsBodyProps) {
  const { dict } = useTranslation();
  const router = useRouter();

  if (initialPage === null) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center text-sm">
        <p className="text-muted">{dict.browse.list.firstFailed}</p>
        <Button variant="secondary" size="sm" onPress={() => router.refresh()}>
          {dict.browse.list.retry}
        </Button>
      </div>
    );
  }

  if (initialPage.total === 0) return <EmptyResults {...props} />;

  return (
    <BrowseResults
      category={props.category}
      state={props.state}
      title={title}
      initialPage={initialPage}
      hasSidebar={props.category.isFilterable}
    />
  );
}

interface BrowseViewProps {
  category: BrowseCategory;
  state: BrowseState;
  currentYear: number;
  initialPage: CatalogPage<TrendingMedia> | null;
}

export function BrowseView({ category, state, currentYear, initialPage }: BrowseViewProps) {
  const { dict, locale } = useTranslation();
  const navigation = useBrowseNavigation(category.slug);
  const presets = yearPresets(currentYear);
  const activeCount = activeFilterCount(state.filters);
  const title = dict.browse.categories[category.slug].title;

  const changeFilters = (filters: BrowseFilters) => navigation.apply({ ...state, filters });
  const changeSort = (sort: BrowseSort) => navigation.apply({ ...state, sort });

  const summary =
    activeCount > 0 && initialPage
      ? countLabel(dict, locale, category.type, initialPage.total)
      : dict.browse.pools[category.pool].caption;

  return (
    <div className="flex flex-col pb-10 md:pt-4">
      <header className="flex items-center gap-3 px-4 pt-2 md:px-0 md:pt-0">
        <h1 className="flex-1 text-3xl font-extrabold tracking-tight md:text-4xl">
          {dict.browse.title}
          <span className="sr-only">{`: ${title}`}</span>
        </h1>
        <TypeTabs category={category} state={state} />
      </header>

      <div className="sticky top-0 z-20 -mt-px flex items-center gap-2 border-b border-separator bg-background/90 px-4 pt-[max(0.625rem,var(--safe-top))] pb-2.5 backdrop-blur-xl md:top-16 md:mt-4 md:px-0 md:pt-2.5">
        <PoolNav category={category} state={state} />
        {category.isFilterable ? (
          <div className="lg:hidden">
            <FiltersDialog
              category={category}
              state={state}
              yearPresets={presets}
              onApply={changeFilters}
            />
          </div>
        ) : null}
      </div>

      <div
        className={
          category.isFilterable
            ? 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pt-6'
            : 'lg:pt-6'
        }
      >
        {category.isFilterable ? (
          <FiltersPanel
            category={category}
            filters={state.filters}
            yearPresets={presets}
            onChange={changeFilters}
          />
        ) : null}

        <section
          aria-label={title}
          aria-busy={navigation.isPending}
          className={`flex min-w-0 flex-col gap-3 px-4 pt-2 transition-opacity md:px-0 lg:pt-0 ${navigation.isPending ? 'opacity-60' : ''}`}
        >
          <div className="flex min-h-tap items-center gap-2">
            <p
              aria-live="polite"
              className="line-clamp-2 min-w-0 flex-1 text-sm leading-snug text-muted"
            >
              {summary}
            </p>
            <SortMenu options={sortsFor(category)} value={state.sort} onChange={changeSort} />
          </div>
          <ActiveFilters filters={state.filters} yearPresets={presets} onChange={changeFilters} />
          <ResultsBody
            category={category}
            state={state}
            title={title}
            initialPage={initialPage}
            yearPresets={presets}
            onChangeFilters={changeFilters}
          />
        </section>
      </div>
      <BackToTop />
    </div>
  );
}
