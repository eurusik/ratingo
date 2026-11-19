'use client';

import { useAuth } from '@ratingo/web-core/auth';
import type { CalendarMediaType, CalendarRange } from '@/shared/api';
import { hasTrackedShows } from './calendar-range';
import type { CalendarMode } from './calendar-query';

interface PersonalizedState {
  data?: CalendarRange;
  isError: boolean;
}

interface ModeInputs {
  requested: CalendarMode | undefined;
  personalized: PersonalizedState;
  type: CalendarMediaType;
}

export function useCalendarMode({
  requested,
  personalized,
  type,
}: ModeInputs): CalendarMode | undefined {
  const { user, isLoading } = useAuth();

  if (requested) return requested;
  if (type === 'movie') return 'all';
  if (isLoading) return undefined;
  if (!user || personalized.isError) return 'all';
  if (!personalized.data) return undefined;
  return hasTrackedShows(personalized.data) ? 'mine' : 'all';
}
