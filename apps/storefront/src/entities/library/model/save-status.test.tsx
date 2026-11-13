import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi } from '@/shared/api';
import { isSaved, useSaveStatus, useLibraryStore } from './save-status';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/api', () => ({ libraryApi: { getSaveStatuses: jest.fn() } }));

const SAVED = { isForLater: true, isConsidering: false };

function signIn(isAuthenticated: boolean) {
  jest.mocked(useAuth).mockReturnValue({ isAuthenticated } as ReturnType<typeof useAuth>);
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSaveStatus', () => {
  beforeEach(() => {
    jest.mocked(libraryApi.getSaveStatuses).mockReset();
  });

  it('asks for every visible title in one request', async () => {
    signIn(true);
    jest.mocked(libraryApi.getSaveStatuses).mockResolvedValue({ 'media-1': SAVED });

    const { result } = renderHook(
      () => [useSaveStatus('media-1'), useSaveStatus('media-2')] as const,
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current[0]).toEqual(SAVED));
    expect(isSaved(result.current[1])).toBe(false);
    expect(libraryApi.getSaveStatuses).toHaveBeenCalledTimes(1);
    expect(libraryApi.getSaveStatuses).toHaveBeenCalledWith(['media-1', 'media-2']);
  });

  it('never asks the API for a guest', () => {
    signIn(false);
    const { result } = renderHook(() => useSaveStatus('media-1'), { wrapper: createWrapper() });

    expect(isSaved(result.current)).toBe(false);
    expect(libraryApi.getSaveStatuses).not.toHaveBeenCalled();
  });

  it('shows a written status at once', async () => {
    signIn(true);
    jest.mocked(libraryApi.getSaveStatuses).mockResolvedValue({});

    const { result } = renderHook(
      () => ({ status: useSaveStatus('media-1'), store: useLibraryStore() }),
      { wrapper: createWrapper() },
    );

    act(() => result.current.store.write('media-1', SAVED));

    await waitFor(() => expect(result.current.status).toEqual(SAVED));
    expect(result.current.store.read('media-1')).toEqual(SAVED);
  });
});
