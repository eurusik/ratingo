'use client';

import { memo } from 'react';
import { Button, Skeleton } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import { useTranslation } from '@/shared/i18n';
import { CALENDAR_MODES, type CalendarMode } from '../model/calendar-query';
import { MODE_PILL, MODE_PILLS_SKELETON } from './calendar-layout';

export interface ModePillsProps {
  mode: CalendarMode | undefined;
  onModeChange: (mode: CalendarMode) => void;
}

interface PlacedModePillsProps extends ModePillsProps {
  className?: string;
}

export const ModePills = memo(function ModePills({
  mode,
  onModeChange,
  className,
}: PlacedModePillsProps) {
  const { dict } = useTranslation();

  if (!mode) return <Skeleton className={cn(MODE_PILLS_SKELETON, className)} />;

  return (
    <div role="group" aria-label={dict.calendar.modesLabel} className={cn('flex gap-2', className)}>
      {CALENDAR_MODES.map((option) => {
        const isSelected = option === mode;
        return (
          <Button
            key={option}
            size="sm"
            variant={isSelected ? 'primary' : 'outline'}
            aria-pressed={isSelected}
            onPress={() => {
              if (!isSelected) onModeChange(option);
            }}
            className={MODE_PILL}
          >
            {dict.calendar.modes[option]}
          </Button>
        );
      })}
    </div>
  );
});
