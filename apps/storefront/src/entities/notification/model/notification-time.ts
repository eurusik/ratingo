const HOUR_MS = 60 * 60 * 1000;
const WEEK_DAYS = 7;

export type NotificationGroup = 'today' | 'week' | 'earlier';

function startOfDay(at: number): number {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

export function notificationGroup(createdAt: string, now: number): NotificationGroup {
  const created = Date.parse(createdAt);
  const today = startOfDay(now);
  if (created >= today) return 'today';
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - (WEEK_DAYS - 1));
  if (created >= weekStart.getTime()) return 'week';
  return 'earlier';
}

export interface Grouped<T> {
  group: NotificationGroup;
  items: T[];
}

export function groupByAge<T extends { createdAt: string }>(
  items: readonly T[],
  now: number,
): Grouped<T>[] {
  const groups = new Map<NotificationGroup, T[]>();
  for (const item of items) {
    const group = notificationGroup(item.createdAt, now);
    const members = groups.get(group);
    if (members) members.push(item);
    else groups.set(group, [item]);
  }
  return (['today', 'week', 'earlier'] as const)
    .filter((group) => groups.has(group))
    .map((group) => ({ group, items: groups.get(group) ?? [] }));
}

export function notificationTime(createdAt: string, now: number, locale: string): string {
  const created = Date.parse(createdAt);
  const group = notificationGroup(createdAt, now);
  if (group === 'today') {
    const hours = Math.max(1, Math.round((now - created) / HOUR_MS));
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }).format(
      -hours,
      'hour',
    );
  }
  if (group === 'week') {
    return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(created);
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(created);
}
