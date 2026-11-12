import fc from 'fast-check';
import { act, renderHook } from '@testing-library/react';
import {
  clearRecentTitles,
  forgetTitle,
  parseRecentTitles,
  rememberTitle,
  useRecentTitles,
  withRecentTitle,
} from './recent-titles';
import type { SearchTitle } from './search-title';

function title(slug: string, type: SearchTitle['type'] = 'movie'): SearchTitle {
  return { key: slug, isInCatalog: true, type, slug, title: slug };
}

describe('recent titles', () => {
  beforeEach(() => clearRecentTitles());

  it('puts the latest title first, without duplicates, and keeps eight', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'), {
          maxLength: 30,
        }),
        (slugs) => {
          const result = slugs.reduce<SearchTitle[]>(
            (titles, slug) => withRecentTitle(titles, title(slug)),
            [],
          );
          const keys = result.map((item) => item.slug);
          expect(new Set(keys).size).toBe(keys.length);
          expect(result.length).toBeLessThanOrEqual(8);
          if (slugs.length > 0) expect(keys[0]).toBe(slugs.at(-1));
        },
      ),
    );
  });

  it('ignores storage it cannot read', () => {
    expect(parseRecentTitles('not json')).toEqual([]);
    expect(parseRecentTitles('[{"title":"no slug"}]')).toEqual([]);
  });

  it('remembers, forgets and clears titles on this device', () => {
    const { result } = renderHook(() => useRecentTitles());

    act(() => rememberTitle(title('dune')));
    act(() => rememberTitle(title('andor', 'show')));
    expect(result.current.map((item) => item.slug)).toEqual(['andor', 'dune']);

    act(() => forgetTitle(title('andor', 'show')));
    expect(result.current.map((item) => item.slug)).toEqual(['dune']);

    act(() => clearRecentTitles());
    expect(result.current).toEqual([]);
  });
});

describe('recent titles across tabs', () => {
  it('reloads when another tab changes them', () => {
    clearRecentTitles();
    const { result } = renderHook(() => useRecentTitles());

    window.localStorage.setItem(
      'ratingo:recent-titles',
      JSON.stringify([
        { key: 'k', isInCatalog: true, type: 'movie', slug: 'sinners', title: 'Грішники' },
      ]),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'ratingo:recent-titles' }));
    });

    expect(result.current.map((item) => item.slug)).toEqual(['sinners']);
  });
});
