'use client';

import { memo } from 'react';
import { Button, Skeleton } from '@heroui/react';
import { cn } from '@ratingo/web-core/lib';
import type { CalendarMediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { CALENDAR_MODES, type CalendarMode } from '../model/calendar-query';
import { MODE_PILL, MODE_PILLS_SKELETON } from './calendar-layout';

export interface ModePillsProps {
  type: CalendarMediaType;
  mode: CalendarMode | undefined;
  onModeChange: (mode: CalendarMode) => void;
}

interface PlacedModePillsProps extends ModePillsProps {
  className?: string;
}

export const ModePills = memo(function ModePills({
  type,
  mode,
  onModeChange,
  className,
}: PlacedModePillsProps) {
  const { dict } = useTranslation();
  const label = dict.calendar.modesLabel[type];

  if (!mode) return <Skeleton className={cn(MODE_PILLS_SKELETON, className)} />;

  return (
    <div role="group" aria-label={label} className={cn('flex gap-2', className)}>
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
