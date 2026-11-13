import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost } from '@ratingo/web-core/api';

export type NotificationItem = components['schemas']['NotificationItemDto'];
export type NotificationList = components['schemas']['NotificationListResponseDto'];

type MarkReadResult = components['schemas']['MarkReadResponseDto'];

export const notificationsApi = {
  list(limit: number): Promise<NotificationList> {
    return apiGet<NotificationList>('me/notifications', { searchParams: { limit } });
  },

  markAsRead(notificationId: string): Promise<MarkReadResult> {
    return apiPost<MarkReadResult>(`me/notifications/${notificationId}/read`);
  },

  markAllAsRead(): Promise<MarkReadResult> {
    return apiPost<MarkReadResult>('me/notifications/read-all');
  },
} as const;
