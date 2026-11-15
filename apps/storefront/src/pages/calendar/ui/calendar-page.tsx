import { kyivDateKey } from '../model/calendar-dates';
import { CalendarView } from './calendar-view';

export function CalendarPage() {
  return <CalendarView today={kyivDateKey(new Date())} />;
}
