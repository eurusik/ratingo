import { CALENDAR_QUERY_KEY } from '@/entities/episode';
import type { CalendarRangeQuery } from '@/shared/api';

interface CalendarKeyFields extends CalendarRangeQuery {
  viewerId: string | null;
}

export function calendarKey(fields: CalendarKeyFields) {
  return [...CALENDAR_QUERY_KEY, fields] as const;
}

export function viewerCalendarKey(viewerId: string | null) {
  return [...CALENDAR_QUERY_KEY, { viewerId }] as const;
}

function keyFields(queryKey: readonly unknown[]): Partial<CalendarKeyFields> {
  const [, fields] = queryKey;
  return typeof fields === 'object' && fields !== null ? fields : {};
}

export function isSameRangeAfterSignIn(
  previousKey: readonly unknown[],
  nextKey: readonly unknown[],
): boolean {
  const previous = keyFields(previousKey);
  const next = keyFields(nextKey);
  return (
    previous.viewerId === null &&
    typeof next.viewerId === 'string' &&
    previous.personalized === next.personalized &&
    previous.premieres === next.premieres &&
    previous.type === next.type &&
    previous.startDate === next.startDate &&
    previous.days === next.days
  );
}
