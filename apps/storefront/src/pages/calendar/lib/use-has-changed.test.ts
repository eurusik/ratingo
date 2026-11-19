import { renderHook } from '@testing-library/react';
import { useHasChanged } from './use-has-changed';

describe('useHasChanged', () => {
  it('stays false while the value keeps its first state', () => {
    const { result, rerender } = renderHook(({ value }) => useHasChanged(value), {
      initialProps: { value: 'week-1:movie:all' },
    });

    rerender({ value: 'week-1:movie:all' });

    expect(result.current).toBe(false);
  });

  it('turns true on the first change and stays true after a change back', () => {
    const { result, rerender } = renderHook(({ value }) => useHasChanged(value), {
      initialProps: { value: 'week-1:movie:all' },
    });

    rerender({ value: 'week-2:movie:all' });
    expect(result.current).toBe(true);

    rerender({ value: 'week-1:movie:all' });
    expect(result.current).toBe(true);
  });
});
