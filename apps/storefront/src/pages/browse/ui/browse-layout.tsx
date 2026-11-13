import type { ReactNode } from 'react';

interface BrowseLayoutProps {
  heading?: ReactNode;
  typeSwitch: ReactNode;
  pools: ReactNode;
  filtersButton?: ReactNode;
  filtersPanel?: ReactNode;
  summary: ReactNode;
  sort: ReactNode;
  results: ReactNode;
  resultsLabel?: string;
  isBusy?: boolean;
}

export function BrowseLayout({
  heading,
  typeSwitch,
  pools,
  filtersButton,
  filtersPanel,
  summary,
  sort,
  results,
  resultsLabel,
  isBusy = false,
}: BrowseLayoutProps) {
  const hasFiltersPanel = filtersPanel != null;

  return (
    <>
      <div className="contents lg:sticky lg:[view-transition-name:browse-toolbar] lg:top-16 lg:z-20 lg:-mt-4 lg:flex lg:items-center lg:gap-5 lg:border-b lg:border-separator lg:bg-background/90 lg:py-4 lg:backdrop-blur-xl">
        <header className="px-4 md:px-0 lg:shrink-0">
          {heading}
          {typeSwitch}
        </header>

        <span aria-hidden className="hidden h-7 w-px shrink-0 bg-separator lg:block" />

        <div className="sticky top-0 z-20 -mt-px [view-transition-name:browse-toolbar] lg:[view-transition-name:none] flex items-center gap-2 border-b border-separator bg-background/90 px-4 pt-[max(0.75rem,var(--safe-top))] pb-3 backdrop-blur-xl md:top-16 md:px-0 md:pt-3 lg:static lg:mt-0 lg:min-w-0 lg:flex-1 lg:border-b-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          {pools}
          {filtersButton == null ? null : <div className="lg:hidden">{filtersButton}</div>}
        </div>
      </div>

      <div
        className={
          hasFiltersPanel
            ? 'lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pt-4'
            : 'lg:pt-4'
        }
      >
        {hasFiltersPanel ? (
          <div className="sticky top-39 hidden max-h-[calc(100dvh-10.75rem)] overflow-y-auto overscroll-contain rounded-3xl bg-surface p-5 lg:block">
            {filtersPanel}
          </div>
        ) : null}

        <section
          aria-label={resultsLabel}
          aria-busy={isBusy}
          className={`flex min-w-0 flex-col gap-3 px-4 pt-3 transition-opacity md:px-0 lg:pt-0 ${isBusy ? 'opacity-50 delay-150 duration-200' : 'duration-150'}`}
        >
          <div className="flex min-h-tap items-center gap-2">
            {summary}
            {sort}
          </div>
          {results}
        </section>
      </div>
    </>
  );
}
