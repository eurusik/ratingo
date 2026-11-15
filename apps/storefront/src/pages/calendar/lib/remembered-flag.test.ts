import { act, renderHook } from '@testing-library/react';
import { useRememberedFlag } from './remembered-flag';

describe('useRememberedFlag', () => {
  it('remembers a flag per key across remounts', () => {
    const first = renderHook(() => useRememberedFlag('2026-11-09:past'));
    act(() => first.result.current[1](true));
    first.unmount();

    expect(renderHook(() => useRememberedFlag('2026-11-09:past')).result.current[0]).toBe(true);
    expect(renderHook(() => useRememberedFlag('2026-11-16:past')).result.current[0]).toBe(false);
  });

  it('starts from the given default until the viewer changes it', () => {
    const flag = renderHook(() => useRememberedFlag('2026-11-23:past', true));
    expect(flag.result.current[0]).toBe(true);

    act(() => flag.result.current[1](false));
    expect(flag.result.current[0]).toBe(false);
  });
});
