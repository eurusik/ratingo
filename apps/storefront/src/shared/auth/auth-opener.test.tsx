import { act, renderHook } from '@testing-library/react';
import { useAuth } from '@ratingo/web-core/auth';
import { closeAuth, openAuth, useAuthRequest, useSignedInAction } from './auth-opener';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));

function mockSession(isAuthenticated: boolean) {
  jest.mocked(useAuth).mockReturnValue({ isAuthenticated } as ReturnType<typeof useAuth>);
}

describe('auth opener', () => {
  afterEach(() => act(() => closeAuth()));

  it('opens sign-in by default and closes it', () => {
    const { result } = renderHook(() => useAuthRequest());

    act(() => openAuth());
    expect(result.current).toEqual({ mode: 'login' });

    act(() => closeAuth());
    expect(result.current).toBeNull();
  });

  it('runs the action at once for a signed-in user', () => {
    mockSession(true);
    const action = jest.fn();
    const { result } = renderHook(() => ({ run: useSignedInAction(), request: useAuthRequest() }));

    act(() =>
      result.current.run(action, { kind: 'save', title: 'Андор', mediaItemId: 'andor-id' }),
    );

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.request).toBeNull();
  });

  it('asks a guest to sign in and keeps the action to replay', () => {
    mockSession(false);
    const action = jest.fn();
    const { result } = renderHook(() => ({ run: useSignedInAction(), request: useAuthRequest() }));

    act(() =>
      result.current.run(action, { kind: 'save', title: 'Андор', mediaItemId: 'andor-id' }),
    );

    expect(action).not.toHaveBeenCalled();
    expect(result.current.request).toMatchObject({
      mode: 'login',
      intent: { kind: 'save', title: 'Андор', mediaItemId: 'andor-id' },
    });
    result.current.request?.onSignedIn?.();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
