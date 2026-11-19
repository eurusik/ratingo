import type { CalendarMovie } from '@/shared/api';
import type { Dictionary } from '@/shared/i18n';

export function movieLine(
  movie: Pick<CalendarMovie, 'releaseDateKind' | 'isSavedForLater'>,
  isReminderOn: boolean,
  dict: Dictionary,
): string {
  const release = dict.release[movie.releaseDateKind];
  if (isReminderOn) return `${release} · ${dict.calendar.reminderNote}`;
  if (movie.isSavedForLater) return `${release} · ${dict.calendar.savedNote}`;
  return release;
}
