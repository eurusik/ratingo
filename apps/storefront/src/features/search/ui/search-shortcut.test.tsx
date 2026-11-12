import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { setSearchOpen, useIsSearchOpen } from '../model/search-dialog-state';
import { SearchShortcut } from './search-shortcut';

describe('SearchShortcut', () => {
  afterEach(() => act(() => setSearchOpen(false)));

  it.each([
    ['⌘K', { metaKey: true }],
    ['Ctrl K', { ctrlKey: true }],
  ])('toggles search with %s', (_label, modifier) => {
    render(<SearchShortcut />);
    const { result } = renderHook(() => useIsSearchOpen());

    act(() => {
      fireEvent.keyDown(document, { key: 'k', ...modifier });
    });
    expect(result.current).toBe(true);

    act(() => {
      fireEvent.keyDown(document, { key: 'K', ...modifier });
    });
    expect(result.current).toBe(false);
  });

  it('ignores K without a modifier', () => {
    render(<SearchShortcut />);
    const { result } = renderHook(() => useIsSearchOpen());

    act(() => {
      fireEvent.keyDown(document, { key: 'k' });
    });

    expect(result.current).toBe(false);
  });
});
