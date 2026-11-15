import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Popover } from '@heroui/react';
import { notificationsApi, type NotificationItem } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { NotificationPanel } from './notification-panel';

jest.mock('@ratingo/web-core/auth', () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { id: 'user-1' } }),
}));

jest.mock('@/shared/api', () => ({
  notificationsApi: { list: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn() },
}));

const uk = getDictionary('uk');

const SEASON: NotificationItem = {
  id: 'n-1',
  trigger: 'new_season',
  payload: { seasonNumber: 4 },
  isRead: false,
  createdAt: '2026-11-12T08:00:00.000Z',
  mediaSummary: { id: 'm-1', type: 'show', title: 'Ведмідь', slug: 'the-bear', poster: null },
};

function renderPanel(onNavigate = jest.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={uk}>
        <Popover isOpen>
          <button type="button">trigger</button>
          <Popover.Content>
            <Popover.Dialog>
              <NotificationPanel unreadCount={1} onNavigate={onNavigate} />
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </I18nProvider>
    </QueryClientProvider>,
  );
  return onNavigate;
}

describe('NotificationPanel', () => {
  afterEach(() => jest.clearAllMocks());

  it('lists the latest notifications as links and marks one read on open', async () => {
    jest
      .mocked(notificationsApi.list)
      .mockResolvedValue({ data: [SEASON], unreadCount: 1, total: 1, hasMore: false });
    jest.mocked(notificationsApi.markAsRead).mockResolvedValue({ success: true });
    const onNavigate = renderPanel();

    const list = await screen.findByRole('list', { name: uk.notifications.title });
    const link = within(list).getByRole('link', { name: /Ведмідь — повернувся сезон 4/ });
    expect(link).toHaveAttribute('href', '/shows/the-bear');
    expect(notificationsApi.list).toHaveBeenCalledWith(5);

    fireEvent.click(link);
    await waitFor(() => expect(notificationsApi.markAsRead).toHaveBeenCalledWith('n-1'));
    expect(onNavigate).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: uk.notifications.viewAll })).toHaveAttribute(
      'href',
      '/notifications',
    );
  });

  it('says when there is nothing new', async () => {
    jest
      .mocked(notificationsApi.list)
      .mockResolvedValue({ data: [], unreadCount: 0, total: 0, hasMore: false });
    renderPanel();

    expect(await screen.findByText(uk.notifications.empty)).toHaveAttribute('role', 'status');
  });
});
