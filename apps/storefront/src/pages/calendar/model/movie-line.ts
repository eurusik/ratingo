import type { CalendarMovie } from '@/shared/api';
import type { Dictionary } from '@/shared/i18n';

interface MovieLineState {
  isComingOut: boolean;
  isReminderOn: boolean;
}

export function movieLine(
  movie: Pick<CalendarMovie, 'releaseDateKind' | 'isSavedForLater'>,
  { isComingOut, isReminderOn }: MovieLineState,
  dict: Dictionary,
): string {
  const release = dict.release[movie.releaseDateKind];
  if (isComingOut && isReminderOn) return `${release} · ${dict.calendar.reminderNote}`;
  if (movie.isSavedForLater) return `${release} · ${dict.calendar.savedNote}`;
  return release;
}
