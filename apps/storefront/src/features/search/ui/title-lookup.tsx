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

const RESULTS_CLASS =
  'flex w-full flex-col text-start divide-y divide-separator rounded-[20px] bg-surface px-3.5';
const ROW_CLASS = 'flex min-h-19 items-center gap-3 py-2.5';

function FoundTitle({ title }: { title: SearchTitle & { slug: string } }) {
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

function hasSlug(title: SearchTitle): title is SearchTitle & { slug: string } {
  return title.slug !== undefined;
}

interface TitleLookupProps {
  initialQuery?: string;
  limit: number;
  fallback: ReactNode;
}

export function TitleLookup({ initialQuery = '', limit, fallback }: TitleLookupProps) {
  const { dict } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const search = useCatalogSearch(query, 'all');
  const found = search.results.catalog.filter(hasSlug).slice(0, limit);
  const isWaiting = search.isActive && search.isSearching && found.length === 0;

  const renderResults = () => {
    if (isWaiting) return <FoundTitlesSkeleton count={limit} />;
    if (!search.isActive || search.isError) return fallback;
    if (found.length === 0) {
      return (
        <>
          <p role="status" className="pb-3 text-sm text-muted">
            {interpolate(dict.search.noResults, { query: search.term })}
          </p>
          {fallback}
        </>
      );
    }

    return (
      <ul aria-label={dict.search.results} className={RESULTS_CLASS}>
        {found.map((title) => (
          <FoundTitle key={title.key} title={title} />
        ))}
      </ul>
    );
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="w-full md:w-120">
        <ListSearch
          label={dict.search.trigger}
          placeholder={dict.search.placeholder}
          value={query}
          onChange={setQuery}
        />
      </div>
      <div className="flex w-full flex-col items-center">{renderResults()}</div>
    </div>
  );
}
