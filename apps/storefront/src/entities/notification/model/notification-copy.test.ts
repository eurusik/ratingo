import type { NotificationItem } from '@/shared/api';
import { getDictionary } from '@/shared/i18n';
import { notificationDetail, notificationText } from './notification-copy';

const uk = getDictionary('uk');

function notification(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'n',
    trigger: 'release',
    payload: null,
    isRead: false,
    createdAt: '2026-11-15T10:00:00Z',
    mediaSummary: { id: 'm', type: 'movie', title: 'Анора', slug: 'anora', poster: null },
    ...overrides,
  };
}

describe('notification copy', () => {
  it('formats the episode code the way the rest of the app does', () => {
    const text = notificationText(
      notification({ trigger: 'new_episode', payload: { episodeKey: 'S4E3' } }),
      uk,
    );
    expect(text).toContain('С4');
    expect(text).not.toContain('S4E3');
  });

  it('names the season when it is known', () => {
    expect(
      notificationText(notification({ trigger: 'new_season', payload: { seasonNumber: 4 } }), uk),
    ).toBe('Анора — повернувся сезон 4');
    expect(notificationText(notification({ trigger: 'new_season' }), uk)).toBe(
      'Анора — повертається новий сезон',
    );
  });

  it('reminds where a released title came from', () => {
    expect(notificationDetail(notification({ trigger: 'on_streaming' }), uk, 'uk')).toBe(
      uk.notifications.sub.fromPlan,
    );
  });
});
