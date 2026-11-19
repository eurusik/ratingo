import { addUtcDays } from '@/common/utils/date.util';
import { effectiveMovieReleaseDate, isMovieReleasingFrom } from '@/modules/catalog/public';

import { MOVIE_DIGITAL_RELEASE_AWAIT_DAYS } from '../domain/constants/subscription.constants';
import {
  SUBSCRIPTION_TRIGGER,
  type SubscriptionTrigger,
} from '../domain/entities/user-subscription.entity';
import { type MovieReleaseSchedule } from '../domain/ports/movie-release.port';

function isReleasePending(schedule: MovieReleaseSchedule, today: Date): boolean {
  return effectiveMovieReleaseDate(schedule) === null || isMovieReleasingFrom(schedule, today);
}

function isDigitalReleasePending(schedule: MovieReleaseSchedule, today: Date): boolean {
  if (schedule.digitalReleaseDate) return schedule.digitalReleaseDate.getTime() >= today.getTime();
  const awaitDigitalSince = addUtcDays(today, -MOVIE_DIGITAL_RELEASE_AWAIT_DAYS);
  return isReleasePending(schedule, awaitDigitalSince);
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
