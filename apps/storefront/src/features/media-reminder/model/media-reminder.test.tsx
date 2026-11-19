import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { subscriptionsApi, type Subscription } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { useMediaReminder } from './media-reminder';

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  subscriptionsApi: { list: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() },
}));
jest.mock('@ratingo/web-core/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, isAuthenticated: true }),
}));
jest.mock('@/shared/auth', () => ({
  useSignedInAction: () => (action: () => void) => action(),
}));
jest.mock('@/shared/lib', () => ({
  ...jest.requireActual('@/shared/lib'),
  track: jest.fn(),
}));
jest.mock('@heroui/react', () => ({
  ...jest.requireActual('@heroui/react'),
  toast: Object.assign(jest.fn(), { danger: jest.fn() }),
}));

const DUNE = { mediaItemId: 'dune-id', title: 'Дюна' };

function subscription(trigger: Subscription['trigger']): Subscription {
  return { mediaItemId: DUNE.mediaItemId, trigger, isActive: true } as Subscription;
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        {children}
      </I18nProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useMediaReminder(DUNE, 'release'), { wrapper });
}

function listSubscriptions(subscriptions: Subscription[]) {
  jest
    .mocked(subscriptionsApi.list)
    .mockResolvedValue({ data: subscriptions, meta: { hasMore: false } } as never);
}

describe('useMediaReminder for a movie release', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(subscriptionsApi.unsubscribe).mockResolvedValue({} as never);
  });

  it('counts an automatic digital-release subscription as a reminder that is on', async () => {
    listSubscriptions([subscription('on_streaming')]);

    const { result } = setup();

    await waitFor(() => expect(result.current.isOn).toBe(true));
  });

  it('turns off both the cinema and the digital release reminder', async () => {
    listSubscriptions([subscription('release'), subscription('on_streaming')]);
    const { result } = setup();
    await waitFor(() => expect(result.current.isOn).toBe(true));

    act(() => result.current.toggle());

    await waitFor(() => expect(subscriptionsApi.unsubscribe).toHaveBeenCalledTimes(2));
    expect(subscriptionsApi.unsubscribe).toHaveBeenCalledWith('dune-id', 'release');
    expect(subscriptionsApi.unsubscribe).toHaveBeenCalledWith('dune-id', 'on_streaming');
  });
});
