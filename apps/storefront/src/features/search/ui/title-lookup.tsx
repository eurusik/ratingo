'use client';

import { useState, type ReactNode } from 'react';
import { Skeleton } from '@heroui/react';
import { ChevronRight } from 'lucide-react';
import { MediaPoster, useScoreLabel } from '@/entities/media';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';
import { ForwardLink, ListSearch } from '@/shared/ui';
import { useCatalogSearch } from '../model/catalog-search';
import type { SearchTitle } from '../model/search-title';

type LinkableTitle = SearchTitle & { slug: string };

const ANY_TYPE = 'all';

const RESULTS_CLASS =
  'flex w-full flex-col text-start divide-y divide-separator rounded-[20px] bg-surface px-3.5';
const ROW_CLASS = 'flex min-h-19 items-center gap-3 py-2.5';

function FoundTitle({ title }: { title: LinkableTitle }) {
  const { dict, locale } = useTranslation();
  const scoreLabel = useScoreLabel();
  const kind = dict.media.type[title.type];
  const score = title.score;
  const shownFacts = [
    kind,
    title.year,
    score === undefined ? undefined : formatScore(locale, score),
  ];
  const spokenFacts = [kind, title.year, score === undefined ? undefined : scoreLabel(score)];

  return (
    <li>
      <ForwardLink
        href={mediaRoute(title.type, title.slug)}
        className={`${ROW_CLASS} text-foreground no-underline outline-none focus-visible:outline-2 focus-visible:outline-focus`}
      >
        <MediaPoster type={title.type} posterUrl={title.posterUrl} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold">{title.title}</span>
          <span aria-hidden className="text-[13px] text-muted tabular-nums">
            {shownFacts.filter(Boolean).join(' · ')}
          </span>
          <span className="sr-only">{spokenFacts.filter(Boolean).join(', ')}</span>
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
      </ForwardLink>
    </li>
  );
}

function FoundTitlesSkeleton({ count }: { count: number }) {
  return (
    <div aria-hidden className={RESULTS_CLASS}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={ROW_CLASS}>
          <Skeleton className="h-15 w-10 rounded-lg" />
          <span className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5 rounded-full" />
            <Skeleton className="h-3 w-2/5 rounded-full" />
          </span>
        </div>
      ))}
    </div>
  );
}

function hasSlug(title: SearchTitle): title is LinkableTitle {
  return title.slug !== undefined;
}

type LookupState = 'idle' | 'searching' | 'found' | 'empty' | 'failed';

function lookupState(
  search: ReturnType<typeof useCatalogSearch>,
  found: readonly LinkableTitle[],
): LookupState {
  if (!search.isActive) return 'idle';
  if (search.isError) return 'failed';
  if (found.length > 0) return 'found';
  return search.isSearching ? 'searching' : 'empty';
}

function useLookupAnnouncement(state: LookupState, count: number, term: string): string {
  const { dict } = useTranslation();
  const announcements: Record<LookupState, string> = {
    idle: '',
    searching: dict.search.searching,
    found: interpolate(dict.search.resultsCount, { count }),
    empty: interpolate(dict.search.noResults, { query: term }),
    failed: dict.search.failed,
  };
  return announcements[state];
}

interface LookupResultsProps {
  state: LookupState;
  found: readonly LinkableTitle[];
  term: string;
  limit: number;
  fallback: ReactNode;
}

function LookupResults({ state, found, term, limit, fallback }: LookupResultsProps) {
  const { dict } = useTranslation();

  if (state === 'searching') return <FoundTitlesSkeleton count={limit} />;
  if (state === 'found') {
    return (
      <ul aria-label={dict.search.results} className={RESULTS_CLASS}>
        {found.map((title) => (
          <FoundTitle key={title.key} title={title} />
        ))}
      </ul>
    );
  }
  if (state === 'empty') {
    return (
      <>
        <p aria-hidden className="pb-3 text-sm text-muted">
          {interpolate(dict.search.noResults, { query: term })}
        </p>
        {fallback}
      </>
    );
  }
  return fallback;
}

interface TitleLookupProps {
  placeholder: string;
  initialQuery?: string;
  limit: number;
  fallback: ReactNode;
}

export function TitleLookup({ placeholder, initialQuery = '', limit, fallback }: TitleLookupProps) {
  const { dict } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const search = useCatalogSearch(query, ANY_TYPE);
  const found = search.results.catalog.filter(hasSlug).slice(0, limit);
  const state = lookupState(search, found);
  const announcement = useLookupAnnouncement(state, found.length, search.term);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="w-full md:w-120">
        <ListSearch
          label={dict.search.trigger}
          placeholder={placeholder}
          value={query}
          onChange={setQuery}
        />
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <div className="flex w-full flex-col items-center">
        <LookupResults
          state={state}
          found={found}
          term={search.term}
          limit={limit}
          fallback={fallback}
        />
      </div>
    </div>
  );
}
