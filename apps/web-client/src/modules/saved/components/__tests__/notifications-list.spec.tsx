/**
 * Tests for NotificationsList — pagination via useInfiniteQuery.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('ky', () => ({ __esModule: true, HTTPError: class HTTPError extends Error {} }));
jest.mock('@/core/api/me-lists.client', () => ({
  meListsApi: {},
  USER_MEDIA_STATE: { WATCHING: 'watching', COMPLETED: 'completed', PLANNED: 'planned', DROPPED: 'dropped', PAUSED: 'paused' },
}));
jest.mock('@/shared/components/infinite-scroll-loader', () => ({
  InfiniteScrollLoader: ({
    hasMore,
    onLoadMore,
  }: {
    hasMore: boolean;
    onLoadMore: () => void;
  }) =>
    hasMore ? <button data-testid="load-more" onClick={onLoadMore}>Load more</button> : null,
}));

jest.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    dict: {
      notifications: {
        subtitle: 'Subtitle',
        markAllRead: 'Mark all',
        markedAllRead: 'Marked',
        undo: 'Undo',
        error: 'Error',
        filters: { unread: 'Непрочитані', all: 'Усі' },
      },
      common: { loading: 'Loading...' },
    },
    locale: 'uk',
  }),
}));

jest.mock('@/core/auth', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

jest.mock('sonner', () => ({ toast: jest.fn() }));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock('@/core/query/keys', () => ({
  queryKeys: {
    userActions: {
      notifications: {
        list: () => ['notifications-list'],
        unreadCount: () => ['notifications-unread'],
        all: ['notifications'],
      },
    },
  },
}));

const mockUseNotificationsPage = jest.fn();
jest.mock('@/core/query', () => ({
  useNotificationsPage: (...args: unknown[]) => mockUseNotificationsPage(...args),
  useMarkAllNotificationsAsRead: () => ({ mutate: jest.fn() }),
}));

jest.mock('../notification-card', () => ({
  NotificationCard: () => <div data-testid="notification-card" />,
}));

jest.mock('../notifications-empty-state', () => ({
  NotificationsEmptyState: () => <div data-testid="empty-state" />,
}));

jest.mock('@/shared/ui', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  Skeleton: () => <div data-testid="skeleton" />,
  ToggleGroup: ({ children }: any) => <div>{children}</div>,
  ToggleGroupItem: ({ children, value }: any) => <button data-testid={`filter-${value}`}>{children}</button>,
}));

import { NotificationsList } from '../notifications-list';

function makeItem() {
  return { id: 'n1', trigger: {}, payload: {}, isRead: false, createdAt: '2026-01-01', mediaSummary: {} };
}

function setQuery(opts: { hasMore?: boolean; isFetchingNextPage?: boolean; fetchNextPage?: jest.Mock } = {}) {
  mockUseNotificationsPage.mockReturnValue({
    data: {
      pages: [{ data: [makeItem()], unreadCount: 1, total: 100, hasMore: opts.hasMore ?? false }],
      pageParams: [0],
    },
    isLoading: false,
    isFetchingNextPage: opts.isFetchingNextPage ?? false,
    hasNextPage: opts.hasMore ?? false,
    fetchNextPage: opts.fetchNextPage ?? jest.fn(),
    isError: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NotificationsList — pagination', () => {
  it('renders load-more when hasNextPage is true', () => {
    setQuery({ hasMore: true });

    render(<NotificationsList />);

    expect(screen.getByTestId('load-more')).toBeInTheDocument();
  });

  it('hides loader when hasNextPage is false', () => {
    setQuery({ hasMore: false });

    render(<NotificationsList />);

    expect(screen.queryByTestId('load-more')).not.toBeInTheDocument();
  });

  it('clicking load-more invokes fetchNextPage', () => {
    const fetchNextPage = jest.fn();
    setQuery({ hasMore: true, fetchNextPage });

    render(<NotificationsList />);

    fireEvent.click(screen.getByTestId('load-more'));

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });
});
