import { addUtcDays } from '@/common/utils/date.util';

import { MOVIE_DIGITAL_RELEASE_AWAIT_DAYS } from '../constants/subscription.constants';
import {
  SUBSCRIPTION_TRIGGER,
  type SubscriptionTrigger,
} from '../entities/user-subscription.entity';
import { type MovieReleaseSchedule } from '../ports/movie-release.port';

function firstKnownReleaseDate(schedule: MovieReleaseSchedule): Date | null {
  return schedule.theatricalReleaseDate ?? schedule.digitalReleaseDate ?? schedule.releaseDate;
}

function isOnOrAfter(date: Date, day: Date): boolean {
  return date.getTime() >= day.getTime();
}

function isReleasePending(schedule: MovieReleaseSchedule, today: Date): boolean {
  const releaseDate = firstKnownReleaseDate(schedule);
  return releaseDate === null || isOnOrAfter(releaseDate, today);
}

function isDigitalReleasePending(schedule: MovieReleaseSchedule, today: Date): boolean {
  if (schedule.digitalReleaseDate) return isOnOrAfter(schedule.digitalReleaseDate, today);
  const releaseDate = firstKnownReleaseDate(schedule);
  const awaitDigitalSince = addUtcDays(today, -MOVIE_DIGITAL_RELEASE_AWAIT_DAYS);
  return releaseDate === null || isOnOrAfter(releaseDate, awaitDigitalSince);
}

export function pendingMovieReleaseTriggers(
  schedule: MovieReleaseSchedule,
  today: Date,
): SubscriptionTrigger[] {
  const triggers: SubscriptionTrigger[] = [];
  if (isDigitalReleasePending(schedule, today)) triggers.push(SUBSCRIPTION_TRIGGER.ON_STREAMING);
  if (isReleasePending(schedule, today)) triggers.push(SUBSCRIPTION_TRIGGER.RELEASE);
  return triggers;
}
