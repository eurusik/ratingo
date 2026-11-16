import { act, renderHook } from '@testing-library/react';
import { readPendingQuery, setSearchOpen, useIsSearchOpen } from './search-dialog-state';
import { useSearchFromUrl } from './search-from-url';

function renderAt(url: string) {
  window.history.replaceState(null, '', url);
  return renderHook(() => {
    useSearchFromUrl();
    return useIsSearchOpen();
  });
}

describe('useSearchFromUrl', () => {
  afterEach(() => act(() => setSearchOpen(false)));

  it('opens the search with the query from the address and drops it from the address', () => {
    const { result } = renderAt('/?q=%D0%94%D1%8E%D0%BD%D0%B0&ref=old');

    expect(result.current).toBe(true);
    expect(readPendingQuery()).toBe('Дюна');
    expect(window.location.pathname + window.location.search).toBe('/?ref=old');
  });

  it('keeps the search closed without a query', () => {
    const { result } = renderAt('/?q=%20');

    expect(result.current).toBe(false);
    expect(window.location.search).toBe('?q=%20');
  });
});
