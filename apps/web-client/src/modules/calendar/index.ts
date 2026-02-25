/**
 * Calendar module public API.
 *
 * Exports components, types, and episode shape for use by the app layer.
 */

export { CalendarPageClient } from './components/calendar-page-client';
export type { CalendarPageClientProps } from './components/calendar-page-client';

export { CalendarWeekNav } from './components/calendar-week-nav';
export type { CalendarWeekNavProps } from './components/calendar-week-nav';

export { CalendarDayGroup } from './components/calendar-day-group';
export type { CalendarDayGroupProps, CalendarEpisode } from './components/calendar-day-group';

export { CalendarSkeleton } from './components/calendar-skeleton';
export { CalendarEmptyState } from './components/calendar-empty-state';
