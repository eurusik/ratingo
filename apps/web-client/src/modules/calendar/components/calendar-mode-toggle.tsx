'use client';

/**
 * Mode toggle for the calendar view.
 *
 * Renders a segmented-control row with two pill buttons:
 * - "Всі" / "All"        — global calendar (default)
 * - "Персоналізований" / "Personalized" — episodes from shows the user is watching
 *
 * Designed to sit ABOVE CalendarWeekNav. Uses the same Tabs design as the
 * Activity page for visual consistency.
 */

import { getDictionary, type Locale } from '@/shared/i18n';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui';

export type CalendarMode = 'all' | 'personalized';

export interface CalendarModeToggleProps {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  locale?: Locale;
}

/**
 * Segmented-control toggle for switching between global and personalized calendar.
 *
 * @example
 * <CalendarModeToggle
 *   mode={mode}
 *   onModeChange={setMode}
 *   locale="uk"
 * />
 */
export function CalendarModeToggle({
  mode,
  onModeChange,
  locale = 'uk',
}: CalendarModeToggleProps) {
  const dict = getDictionary(locale);

  return (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v as CalendarMode)}>
      <TabsList className="bg-cinema-card border border-cinema-borderSoft h-auto gap-1 p-1 w-full sm:w-fit">
        <TabsTrigger
          value="all"
          className="data-[state=active]:bg-cinema-elevated flex-1 sm:flex-none"
        >
          {dict.calendar.modeAll}
        </TabsTrigger>
        <TabsTrigger
          value="personalized"
          className="data-[state=active]:bg-cinema-elevated flex-1 sm:flex-none"
        >
          {dict.calendar.modePersonalized}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
