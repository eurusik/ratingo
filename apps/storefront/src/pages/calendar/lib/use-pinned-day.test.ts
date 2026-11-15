import { act, renderHook } from '@testing-library/react';
import { usePinnedDay } from './use-pinned-day';

describe('usePinnedDay', () => {
  it('keeps the tapped day until the next user scroll gesture', () => {
    const { result } = renderHook(() => usePinnedDay('2026-11-09'));

    act(() => result.current[1]('2026-11-15'));
    expect(result.current[0]).toBe('2026-11-15');

    act(() => {
      window.dispatchEvent(new Event('wheel'));
    });
    expect(result.current[0]).toBeUndefined();
  });

  it('forgets the pin once another week is shown', () => {
    const { result, rerender } = renderHook(({ week }) => usePinnedDay(week), {
      initialProps: { week: '2026-11-09' },
    });

    act(() => result.current[1]('2026-11-15'));
    rerender({ week: '2026-11-16' });

    expect(result.current[0]).toBeUndefined();
  });
});
