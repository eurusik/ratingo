import { act, renderHook } from '@testing-library/react';
import { useDelayedSave } from './use-delayed-save';

const DELAY_MS = 400;

function renderDelayedSave() {
  const save = jest.fn();
  const hook = renderHook(() => useDelayedSave(save, DELAY_MS));
  return { save, hook };
}

describe('useDelayedSave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves the score once the delay passes', () => {
    const { save, hook } = renderDelayedSave();

    act(() => hook.result.current.schedule(7.5));
    expect(save).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(DELAY_MS));
    expect(save).toHaveBeenCalledWith(7.5);
  });

  it('saves only the latest score when scheduled again within the delay', () => {
    const { save, hook } = renderDelayedSave();

    act(() => hook.result.current.schedule(6));
    act(() => jest.advanceTimersByTime(DELAY_MS / 2));
    act(() => hook.result.current.schedule(8));
    act(() => jest.advanceTimersByTime(DELAY_MS));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(8);
  });

  it('drops a pending score when cancelled', () => {
    const { save, hook } = renderDelayedSave();

    act(() => hook.result.current.schedule(5));
    act(() => hook.result.current.cancel());
    act(() => jest.advanceTimersByTime(DELAY_MS));

    expect(save).not.toHaveBeenCalled();
  });

  it('saves a pending score right away on unmount', () => {
    const { save, hook } = renderDelayedSave();

    act(() => hook.result.current.schedule(9));
    hook.unmount();

    expect(save).toHaveBeenCalledWith(9);
  });

  it('does nothing on unmount without a pending score', () => {
    const { save, hook } = renderDelayedSave();

    hook.unmount();

    expect(save).not.toHaveBeenCalled();
  });
});
