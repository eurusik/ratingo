/**
 * Tests for useAutoHideTimer hook.
 *
 * Verifies auto-hide timer scheduling, cancellation, and dragging prevention.
 */

import { renderHook } from '@testing-library/react';
import { useAutoHideTimer } from '../use-auto-hide-timer';

describe('useAutoHideTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should call onHide after 3000ms when schedule is called', () => {
    const onHide = jest.fn();
    const { result } = renderHook(() => useAutoHideTimer(onHide));

    result.current.schedule();

    expect(onHide).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2999);
    expect(onHide).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('should NOT call onHide if isDraggingRef.current is true', () => {
    const onHide = jest.fn();
    const { result } = renderHook(() => useAutoHideTimer(onHide));

    result.current.isDraggingRef.current = true;
    result.current.schedule();

    jest.advanceTimersByTime(3000);

    expect(onHide).not.toHaveBeenCalled();
  });

  it('should prevent onHide from firing when cancel is called', () => {
    const onHide = jest.fn();
    const { result } = renderHook(() => useAutoHideTimer(onHide));

    result.current.schedule();

    jest.advanceTimersByTime(1500);
    result.current.cancel();

    jest.advanceTimersByTime(2000);

    expect(onHide).not.toHaveBeenCalled();
  });

  it('should reset timer when schedule is called twice', () => {
    const onHide = jest.fn();
    const { result } = renderHook(() => useAutoHideTimer(onHide));

    result.current.schedule();

    jest.advanceTimersByTime(2000);
    expect(onHide).not.toHaveBeenCalled();

    // Schedule again (resets timer)
    result.current.schedule();

    // Advance by another 2000ms (should be 2000ms into second timer)
    jest.advanceTimersByTime(2000);
    expect(onHide).not.toHaveBeenCalled();

    // Advance by final 1000ms to complete the second timer
    jest.advanceTimersByTime(1000);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('should have isDraggingRef.current initially false', () => {
    const onHide = jest.fn();
    const { result } = renderHook(() => useAutoHideTimer(onHide));

    expect(result.current.isDraggingRef.current).toBe(false);
  });

  it('should allow onHide to fire when isDraggingRef is set back to false', () => {
    const onHide = jest.fn();
    const { result } = renderHook(() => useAutoHideTimer(onHide));

    result.current.isDraggingRef.current = true;
    result.current.schedule();

    jest.advanceTimersByTime(3000);
    expect(onHide).not.toHaveBeenCalled();

    // Set dragging to false and schedule again
    result.current.isDraggingRef.current = false;
    result.current.schedule();

    jest.advanceTimersByTime(3000);
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('should call onHide with updated callback on re-render', () => {
    const onHide1 = jest.fn();
    const onHide2 = jest.fn();

    const { result, rerender } = renderHook(
      ({ callback }) => useAutoHideTimer(callback),
      { initialProps: { callback: onHide1 } }
    );

    // Rerender with new callback
    rerender({ callback: onHide2 });

    // Schedule after rerender (should use new callback)
    result.current.schedule();

    jest.advanceTimersByTime(3000);

    expect(onHide1).not.toHaveBeenCalled();
    expect(onHide2).toHaveBeenCalledTimes(1);
  });

  it('should be safe to call cancel multiple times', () => {
    const onHide = jest.fn();
    const { result } = renderHook(() => useAutoHideTimer(onHide));

    expect(() => {
      result.current.cancel();
      result.current.cancel();
      result.current.cancel();
    }).not.toThrow();

    expect(onHide).not.toHaveBeenCalled();
  });

  it('should be safe to call cancel before any schedule', () => {
    const onHide = jest.fn();
    const { result } = renderHook(() => useAutoHideTimer(onHide));

    expect(() => {
      result.current.cancel();
    }).not.toThrow();

    expect(onHide).not.toHaveBeenCalled();
  });

  it('should maintain stable schedule and cancel references across re-renders', () => {
    const onHide1 = jest.fn();
    const onHide2 = jest.fn();

    const { result, rerender } = renderHook(
      ({ callback }) => useAutoHideTimer(callback),
      { initialProps: { callback: onHide1 } }
    );

    const firstSchedule = result.current.schedule;
    const firstCancel = result.current.cancel;

    // Rerender with new callback
    rerender({ callback: onHide2 });

    // schedule reference should change (depends on onHide)
    expect(result.current.schedule).not.toBe(firstSchedule);
    // cancel reference should be stable (no dependencies)
    expect(result.current.cancel).toBe(firstCancel);
  });
});
