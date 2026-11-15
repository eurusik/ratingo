export const NOTIFICATIONS_KEY = ['notifications'] as const;

export const UNREAD_COUNT_KEY = [...NOTIFICATIONS_KEY, 'unread-count'] as const;

export type NotificationFilter = 'unread' | 'all';

export const PAGES_SEGMENT = 'pages';

export function notificationPagesKey(filter: NotificationFilter) {
  return [...NOTIFICATIONS_KEY, PAGES_SEGMENT, filter] as const;
}

export function latestNotificationsKey(count: number) {
  return [...NOTIFICATIONS_KEY, 'latest', count] as const;
}
