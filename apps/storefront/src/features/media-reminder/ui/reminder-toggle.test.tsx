import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { subscriptionsApi, type Subscription } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { ReminderToggle } from './reminder-toggle';

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

const SHOW = { mediaItemId: 'show-id', title: 'Гаррі Поттер' };

function listSubscriptions(subscriptions: Subscription[]) {
  jest
    .mocked(subscriptionsApi.list)
    .mockResolvedValue({ data: subscriptions, meta: { hasMore: false } } as never);
}

function renderToggle() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={getDictionary('uk')}>
        <ReminderToggle media={SHOW} trigger="premiere" look="button" />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('ReminderToggle', () => {
  it('offers the premiere reminder while it is off', async () => {
    listSubscriptions([]);
    renderToggle();

    const bell = await screen.findByRole('button', { name: /Нагадати про прем’єру/ });
    expect(bell).toHaveAttribute('aria-pressed', 'false');
  });

  it('says the reminder is set once it is on', async () => {
    listSubscriptions([
      { mediaItemId: SHOW.mediaItemId, trigger: 'premiere', isActive: true } as Subscription,
    ]);
    renderToggle();

    const bell = await screen.findByRole('button', { name: /Нагадаємо/ });
    expect(bell).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Нагадати про прем’єру')).not.toBeInTheDocument();
  });
});
