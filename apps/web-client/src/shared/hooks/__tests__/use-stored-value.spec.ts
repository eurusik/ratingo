import { act, renderHook } from '@testing-library/react';
import { useStoredValue } from '../use-stored-value';

const KEY = 'ratingo:test-stored-value';

describe('useStoredValue', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('returns the stored value', () => {
    localStorage.setItem(KEY, 'personalized');
    const { result } = renderHook(() => useStoredValue(KEY));
    expect(result.current).toBe('personalized');
  });

  it('returns null when nothing is stored', () => {
    const { result } = renderHook(() => useStoredValue(KEY));
    expect(result.current).toBeNull();
  });

  it('picks up changes made in another tab', () => {
    const { result } = renderHook(() => useStoredValue(KEY));

    act(() => {
      localStorage.setItem(KEY, 'all');
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });

    expect(result.current).toBe('all');
  });
});
