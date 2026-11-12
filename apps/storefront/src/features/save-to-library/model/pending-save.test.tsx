import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import { libraryApi } from '@/shared/api';
import { rememberPendingIntent, takePendingIntent } from '@/shared/auth';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { useReplaySaveAfterSignIn } from './pending-save';

jest.mock('@ratingo/web-core/auth', () => ({ useAuth: jest.fn() }));
jest.mock('@/shared/api', () => ({
  libraryApi: { getSaveStatuses: jest.fn(), save: jest.fn(), unsave: jest.fn() },
}));

const ANDOR = { kind: 'save', title: 'Андор', mediaItemId: 'andor-id' } as const;

function setAuth(state: { isLoading: boolean; isAuthenticated: boolean }) {
  jest.mocked(useAuth).mockReturnValue(state as ReturnType<typeof useAuth>);
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('useReplaySaveAfterSignIn', () => {
  beforeEach(() => {
    jest.mocked(libraryApi.getSaveStatuses).mockResolvedValue({});
    jest.mocked(libraryApi.save).mockResolvedValue({ isForLater: true, isConsidering: false });
  });

  afterEach(() => {
    window.sessionStorage.clear();
    jest.clearAllMocks();
  });

  it('saves the title a guest picked once the OAuth redirect signs them in', async () => {
    rememberPendingIntent(ANDOR);
    setAuth({ isLoading: true, isAuthenticated: false });
    const { rerender } = renderHook(() => useReplaySaveAfterSignIn(), { wrapper: Wrapper });

    expect(libraryApi.save).not.toHaveBeenCalled();

    setAuth({ isLoading: false, isAuthenticated: true });
    rerender();

    await waitFor(() => expect(libraryApi.save).toHaveBeenCalledWith('andor-id', 'for_later'));
    expect(libraryApi.save).toHaveBeenCalledTimes(1);
    expect(takePendingIntent()).toBeNull();
  });

  it('drops the intent when the redirect came back signed out', () => {
    rememberPendingIntent(ANDOR);
    setAuth({ isLoading: false, isAuthenticated: false });
    renderHook(() => useReplaySaveAfterSignIn(), { wrapper: Wrapper });

    expect(libraryApi.save).not.toHaveBeenCalled();
    expect(takePendingIntent()).toBeNull();
  });
});
