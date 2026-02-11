import { render, screen, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ky is ESM-only — must mock before any module that transitively imports it.
jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));

import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  useNotificationsPage,
} from '../notifications';
import type { UseNotificationsPageOptions } from '../notifications';
import { queryKeys } from '../keys';

jest.mock('@/core/api', () => ({
  userActionsApi: {
    listNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markNotificationAsRead: jest.fn(),
    markAllNotificationsAsRead: jest.fn(),
  },
}));

import { userActionsApi } from '@/core/api';

const mockListNotifications = userActionsApi.listNotifications as jest.Mock;
const mockGetUnreadCount = userActionsApi.getUnreadCount as jest.Mock;
const mockMarkAsRead = userActionsApi.markNotificationAsRead as jest.Mock;
const mockMarkAllAsRead = userActionsApi.markAllNotificationsAsRead as jest.Mock;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function NotificationsConsumer({ enabled = true }: { enabled?: boolean }) {
  const query = useNotifications(enabled);

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function UnreadCountConsumer({ enabled = true }: { enabled?: boolean }) {
  const query = useUnreadNotificationCount(enabled);

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="count">{String(query.data?.unreadCount ?? 'none')}</span>
    </div>
  );
}

function MarkReadConsumer() {
  const mutation = useMarkNotificationAsRead();

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button
        data-testid="mark-read"
        onClick={() => mutation.mutate('notification-1')}
      />
    </div>
  );
}

function MarkAllReadConsumer() {
  const mutation = useMarkAllNotificationsAsRead();

  return (
    <div>
      <span data-testid="mutation-status">{mutation.status}</span>
      <button data-testid="mark-all-read" onClick={() => mutation.mutate()} />
    </div>
  );
}

function NotificationsPageConsumer({ options = {} }: { options?: UseNotificationsPageOptions }) {
  const query = useNotificationsPage(options);

  return (
    <div>
      <span data-testid="status">{query.status}</span>
      <span data-testid="data">{JSON.stringify(query.data ?? null)}</span>
    </div>
  );
}

function renderWithClient(ui: React.ReactElement, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('useNotifications', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches notifications when enabled', async () => {
    const mockData = { notifications: [{ id: '1' }], unreadCount: 1 };
    mockListNotifications.mockResolvedValue(mockData);

    renderWithClient(<NotificationsConsumer enabled />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockListNotifications).toHaveBeenCalledWith({ limit: 20 });
    expect(screen.getByTestId('data').textContent).toBe(JSON.stringify(mockData));
  });

  it('does not fetch when disabled', async () => {
    renderWithClient(<NotificationsConsumer enabled={false} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockListNotifications).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });
});

describe('useUnreadNotificationCount', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches unread count when enabled', async () => {
    mockGetUnreadCount.mockResolvedValue({ unreadCount: 5 });

    renderWithClient(<UnreadCountConsumer enabled />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('5');
    });
  });

  it('does not fetch when disabled', async () => {
    renderWithClient(<UnreadCountConsumer enabled={false} />, queryClient);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockGetUnreadCount).not.toHaveBeenCalled();
  });
});

describe('useMarkNotificationAsRead', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls API and invalidates notification caches on success', async () => {
    mockMarkAsRead.mockResolvedValue({ success: true });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<MarkReadConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-read').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockMarkAsRead).toHaveBeenCalledWith('notification-1');
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.userActions.notifications.all,
      }),
    );

    invalidateSpy.mockRestore();
  });
});

describe('useMarkAllNotificationsAsRead', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('calls API and invalidates notification caches on success', async () => {
    mockMarkAllAsRead.mockResolvedValue({ success: true, count: 3 });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    renderWithClient(<MarkAllReadConsumer />, queryClient);

    await act(async () => {
      screen.getByTestId('mark-all-read').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('mutation-status').textContent).toBe('success');
    });

    expect(mockMarkAllAsRead).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.userActions.notifications.all,
      }),
    );

    invalidateSpy.mockRestore();
  });
});

describe('useNotificationsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches notifications with default options', async () => {
    const mockData = { notifications: [{ id: '1' }], unreadCount: 1 };
    mockListNotifications.mockResolvedValue(mockData);

    renderWithClient(<NotificationsPageConsumer />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockListNotifications).toHaveBeenCalledWith({ limit: 20 });
    expect(screen.getByTestId('data').textContent).toBe(JSON.stringify(mockData));
  });

  it('passes unread filter to API when specified', async () => {
    const mockData = { notifications: [{ id: '2' }], unreadCount: 1 };
    mockListNotifications.mockResolvedValue(mockData);

    renderWithClient(
      <NotificationsPageConsumer options={{ unread: true }} />,
      queryClient,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('success');
    });

    expect(mockListNotifications).toHaveBeenCalledWith({ limit: 20, unread: true });
  });

  it('does not fetch when disabled', async () => {
    renderWithClient(
      <NotificationsPageConsumer options={{ enabled: false }} />,
      queryClient,
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockListNotifications).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('pending');
  });
});
