'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { calendarApi, type CalendarRangeQuery } from '@/shared/api';
import { calendarKey, isSameRangeAfterSignIn } from './calendar-keys';

const GUEST_STALE_MS = 5 * 60 * 1000;
const VIEWER_STALE_MS = 30 * 1000;

function rangeOptions(viewerId: string | null, query: CalendarRangeQuery) {
  return {
    queryKey: calendarKey({ viewerId, ...query }),
    queryFn: () => calendarApi.getRange(query),
    staleTime: viewerId === null ? GUEST_STALE_MS : VIEWER_STALE_MS,
  };
}

interface CalendarRangeOptions {
  query: CalendarRangeQuery;
  isEnabled?: boolean;
}

export function useCalendarRange({ query, isEnabled = true }: CalendarRangeOptions) {
  const { user, isLoading } = useAuth();
  const viewerId = user?.id ?? null;
  const canLoad = isEnabled && !isLoading && (!query.personalized || viewerId !== null);
  const options = rangeOptions(viewerId, query);

  return useQuery({
    ...options,
    queryFn: canLoad ? options.queryFn : skipToken,
    placeholderData: (previousData, previousQuery) =>
      previousQuery && isSameRangeAfterSignIn(previousQuery.queryKey, options.queryKey)
        ? previousData
        : undefined,
  });
}
