import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { useIsApplePlatform } from '@/shared/lib';
import { setSearchOpen, useIsSearchOpen } from '../model/search-dialog-state';
import { SearchShortcut, SearchShortcutKbd } from './search-shortcut';

jest.mock('@/shared/lib', () => ({ useIsApplePlatform: jest.fn() }));

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

describe('SearchShortcutKbd', () => {
  it('keeps its place while the platform is unknown so the field does not jump', () => {
    jest.mocked(useIsApplePlatform).mockReturnValue(null);
    const { container } = render(<SearchShortcutKbd />);
    expect(container.querySelector('kbd')).toHaveClass('opacity-0');
  });

  it.each([
    [true, '⌘'],
    [false, '⌃'],
  ])('shows the right modifier once the platform is known (Apple: %s)', (isApple, modifier) => {
    jest.mocked(useIsApplePlatform).mockReturnValue(isApple);
    const { container } = render(<SearchShortcutKbd />);
    const kbd = container.querySelector('kbd');
    expect(kbd).toHaveClass('opacity-100');
    expect(kbd).toHaveTextContent(modifier);
  });
});
