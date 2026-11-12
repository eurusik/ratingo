import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notificationsApi, type NotificationItem } from '@/shared/api';
import { I18nProvider, getDictionary } from '@/shared/i18n';
import { NotificationPanel } from './notification-panel';

jest.mock('@/shared/api', () => ({
  notificationsApi: { list: jest.fn(), markAsRead: jest.fn(), markAllAsRead: jest.fn() },
}));

const uk = getDictionary('uk');

const EPISODE: NotificationItem = {
  id: 'n-1',
  trigger: 'new_episode',
  payload: null,
  isRead: false,
  createdAt: '2026-11-12T08:00:00.000Z',
  mediaSummary: { id: 'm-1', type: 'show', title: 'Андор', slug: 'andor', poster: null },
};

function renderPanel(onNavigate = jest.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk" dictionary={uk}>
        <NotificationPanel onNavigate={onNavigate} />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return onNavigate;
}

describe('NotificationPanel', () => {
  afterEach(() => jest.clearAllMocks());

  it('lists the latest notifications as links and marks them all read', async () => {
    jest
      .mocked(notificationsApi.list)
      .mockResolvedValue({ data: [EPISODE], unreadCount: 1, total: 1, hasMore: false });
    jest.mocked(notificationsApi.markAllAsRead).mockResolvedValue({ success: true, count: 1 });
    renderPanel();

    const list = await screen.findByRole('listbox', { name: uk.notifications.title });
    const item = await within(list).findByRole('option', {
      name: `${uk.notifications.events.new_episode} Андор`,
    });
    expect(item).toHaveAttribute('href', '/shows/andor');
    expect(notificationsApi.list).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByRole('button', { name: uk.notifications.markAllRead }));
    await waitFor(() => expect(notificationsApi.markAllAsRead).toHaveBeenCalledTimes(1));
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
    expect(
      screen.queryByRole('button', { name: uk.notifications.markAllRead }),
    ).not.toBeInTheDocument();
  });
});
