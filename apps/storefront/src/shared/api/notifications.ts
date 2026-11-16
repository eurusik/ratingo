import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost } from '@ratingo/web-core/api';

export type NotificationItem = components['schemas']['NotificationItemDto'];
export type NotificationTrigger = NotificationItem['trigger'];
export type NotificationList = components['schemas']['NotificationListResponseDto'];

type MarkReadResult = components['schemas']['MarkReadResponseDto'];
type UnreadCount = components['schemas']['UnreadCountResponseDto'];

export const notificationsApi = {
  list(limit: number, offset = 0, unreadOnly = false): Promise<NotificationList> {
    return apiGet<NotificationList>('me/notifications', {
      searchParams: { limit, offset, ...(unreadOnly ? { unread: true } : {}) },
    });
  },

  async unreadCount(): Promise<number> {
    const result = await apiGet<UnreadCount>('me/notifications/unread-count');
    return result.unreadCount;
  },

  markAsRead(notificationId: string): Promise<MarkReadResult> {
    return apiPost<MarkReadResult>(`me/notifications/${notificationId}/read`);
  },

  markAllAsRead(): Promise<MarkReadResult> {
    return apiPost<MarkReadResult>('me/notifications/read-all');
  },
} as const;
