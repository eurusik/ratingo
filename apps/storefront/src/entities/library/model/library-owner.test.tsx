import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { useForgetLibraryOnUserChange } from './library-owner';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));

const SAVED_KEY = ['library', 'save-status', 'andor-id'];

function signInAs(userId: string | null) {
  jest
    .mocked(useAuth)
    .mockReturnValue({ user: userId ? { id: userId } : null } as ReturnType<typeof useAuth>);
}

function renderOwner(queryClient: QueryClient) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useForgetLibraryOnUserChange(), { wrapper });
}

describe('useForgetLibraryOnUserChange', () => {
  it('forgets the library when the session ends or another user signs in', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(SAVED_KEY, { isForLater: true, isConsidering: false });
    signInAs('user-1');
    const { rerender } = renderOwner(queryClient);

    expect(queryClient.getQueryData(SAVED_KEY)).toBeDefined();

    signInAs(null);
    rerender();

    expect(queryClient.getQueryData(SAVED_KEY)).toBeUndefined();
  });

  it('keeps what a guest just saved when they sign in', () => {
    const queryClient = new QueryClient();
    signInAs(null);
    const { rerender } = renderOwner(queryClient);
    queryClient.setQueryData(SAVED_KEY, { isForLater: true, isConsidering: false });

    signInAs('user-1');
    rerender();

    expect(queryClient.getQueryData(SAVED_KEY)).toBeDefined();
  });
});
