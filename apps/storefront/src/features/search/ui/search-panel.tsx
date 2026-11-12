'use client';

import { useState, type ReactNode } from 'react';
import { GridList, GridListHeader, GridListSection } from 'react-aria-components';
import {
  Autocomplete,
  Button,
  Kbd,
  SearchField,
  Spinner,
  headerVariants,
  listboxVariants,
} from '@heroui/react';
import { X } from 'lucide-react';
import { interpolate, useTranslation, type Dictionary } from '@/shared/i18n';
import { SegmentedFilter } from '@/shared/ui';
import { useCatalogSearch, type SearchFilter, type SearchResults } from '../model/catalog-search';
import { useOpenTitle } from '../model/open-title';
import { useResultsKeyboard } from '../model/results-keyboard';
import { usePopularTitles } from '../model/popular-titles';
import { clearRecentTitles, forgetTitle, useRecentTitles } from '../model/recent-titles';
import type { SearchTitle } from '../model/search-title';
import { ImportProgress } from './import-progress';
import { KeyboardHints } from './keyboard-hints';
import { TitleRow } from './title-row';

export type RenderTitleActions = (title: SearchTitle) => ReactNode;

const SEARCH_FILTERS: readonly SearchFilter[] = ['all', 'movie', 'show'];
const LIST_CLASS = listboxVariants({ className: 'p-0' });
const SECTION_HEADER_CLASS = headerVariants({
  className: 'px-2 pt-3 pb-1 text-sm font-bold text-muted',
});

interface SearchPanelProps {
  renderActions?: RenderTitleActions;
  onClose: () => void;
}

function RecentRemoveButton({ title }: { title: SearchTitle }) {
  const { dict } = useTranslation();

  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      className="phone-tap-target"
      aria-label={interpolate(dict.search.removeRecent, { title: title.title })}
      onPress={() => forgetTitle(title)}
    >
      <X aria-hidden className="size-4" />
    </Button>
  );
}

function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-2 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

function ResultSections({
  results,
  renderActions,
}: {
  results: SearchResults;
  renderActions?: RenderTitleActions;
}) {
  const { dict } = useTranslation();

  return (
    <>
      {results.catalog.length > 0 ? (
        <GridListSection aria-label={dict.search.results}>
          {results.catalog.map((title) => (
            <TitleRow key={title.key} title={title} trailing={renderActions?.(title)} />
          ))}
        </GridListSection>
      ) : null}
      {results.more.length > 0 ? (
        <GridListSection>
          <GridListHeader className={SECTION_HEADER_CLASS}>
            {dict.search.otherResults}
          </GridListHeader>
          {results.more.map((title) => (
            <TitleRow key={title.key} title={title} />
          ))}
        </GridListSection>
      ) : null}
    </>
  );
}

interface StartSectionsProps {
  recentTitles: readonly SearchTitle[];
  popularTitles: readonly SearchTitle[];
  renderActions?: RenderTitleActions;
}

function StartSections({ recentTitles, popularTitles, renderActions }: StartSectionsProps) {
  const { dict } = useTranslation();

  return (
    <>
      {recentTitles.length > 0 ? (
        <GridListSection aria-label={dict.search.recent}>
          {recentTitles.map((title) => (
            <TitleRow
              key={title.key}
              title={title}
              trailing={<RecentRemoveButton title={title} />}
            />
          ))}
        </GridListSection>
      ) : null}
      {popularTitles.length > 0 ? (
        <GridListSection>
          <GridListHeader className={SECTION_HEADER_CLASS}>{dict.search.popular}</GridListHeader>
          {popularTitles.map((title, index) => (
            <TitleRow
              key={title.key}
              title={title}
              rank={index + 1}
              trailing={renderActions?.(title)}
            />
          ))}
        </GridListSection>
      ) : null}
    </>
  );
}

function searchAnnouncement(search: ReturnType<typeof useCatalogSearch>, dict: Dictionary): string {
  if (!search.isActive) return '';
  if (search.isError) return dict.search.failed;
  if (search.isSearching) return dict.search.searching;
  const count = search.results.catalog.length + search.results.more.length;
  return count === 0
    ? interpolate(dict.search.noResults, { query: search.term })
    : interpolate(dict.search.resultsCount, { count });
}

export function SearchPanel({ renderActions, onClose }: SearchPanelProps) {
  const { dict } = useTranslation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const search = useCatalogSearch(query, filter);
  const recentTitles = useRecentTitles();
  const popularTitles = usePopularTitles();
  const { open, titleImport, cancelImport } = useOpenTitle(onClose);
  const shownTitles = search.isActive
    ? [...search.results.catalog, ...search.results.more]
    : [...recentTitles, ...popularTitles];
  const { inputRef, listRef, onInputKeyDown } = useResultsKeyboard(() => {
    const [firstTitle] = shownTitles;
    if (!firstTitle) return false;
    open(firstTitle);
    return true;
  });

  if (titleImport) {
    return (
      <ImportProgress
        titleImport={titleImport}
        onRetry={() => open(titleImport.title)}
        onBack={cancelImport}
      />
    );
  }

  const announcement = searchAnnouncement(search, dict);
  const titlesByKey = new Map(shownTitles.map((title) => [title.key, title]));

  const renderEmptyState = () => {
    if (!search.isActive) return null;
    if (search.isError) {
      return (
        <StatusMessage>
          {dict.search.failed}
          <Button
            size="sm"
            variant="secondary"
            className="phone-tap-target"
            onPress={() => void search.retry()}
          >
            {dict.common.retry}
          </Button>
        </StatusMessage>
      );
    }
    if (search.isSearching) {
      return (
        <StatusMessage>
          <Spinner size="sm" aria-hidden />
          {dict.search.searching}
        </StatusMessage>
      );
    }
    return (
      <StatusMessage>{interpolate(dict.search.noResults, { query: search.term })}</StatusMessage>
    );
  };

  return (
    <div className="flex flex-col gap-3 md:min-h-96">
      <Autocomplete.Filter inputValue={query} onInputChange={setQuery}>
        <SearchField aria-label={dict.search.title} variant="secondary" autoFocus fullWidth>
          <SearchField.Group className="h-12">
            <SearchField.SearchIcon />
            <SearchField.Input
              ref={inputRef}
              onKeyDown={onInputKeyDown}
              placeholder={dict.search.placeholder}
              autoComplete="off"
              className="text-base"
            />
            <SearchField.ClearButton className="phone-tap-target" />
            <Kbd className="me-2 hidden md:inline-flex" aria-hidden>
              <Kbd.Content>esc</Kbd.Content>
            </Kbd>
          </SearchField.Group>
        </SearchField>
        {search.isActive ? (
          <SegmentedFilter
            label={dict.search.filterLabel}
            options={SEARCH_FILTERS.map((id) => ({ id, label: dict.search.filters[id] }))}
            value={filter}
            onChange={setFilter}
            className="px-0"
          />
        ) : null}
        {!search.isActive && recentTitles.length > 0 ? (
          <div className="-mb-3 flex items-center justify-between px-2">
            <span aria-hidden className="text-sm font-bold text-muted">
              {dict.search.recent}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="phone-tap-target"
              onPress={clearRecentTitles}
            >
              {dict.search.clearRecent}
            </Button>
          </div>
        ) : null}
        <GridList
          ref={listRef}
          aria-label={search.isActive ? dict.search.results : dict.search.title}
          className={LIST_CLASS}
          onAction={(key) => {
            const title = titlesByKey.get(String(key));
            if (title) open(title);
          }}
          renderEmptyState={renderEmptyState}
        >
          {search.isActive ? (
            <ResultSections results={search.results} renderActions={renderActions} />
          ) : (
            <StartSections
              recentTitles={recentTitles}
              popularTitles={popularTitles}
              renderActions={renderActions}
            />
          )}
        </GridList>
      </Autocomplete.Filter>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <KeyboardHints />
    </div>
  );
}
