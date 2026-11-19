'use client';

import { useId, useState } from 'react';
import { Button } from '@heroui/react';
import { Info } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import type { CalendarMediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { SegmentedFilter, TitleSwitch } from '@/shared/ui';
import { CALENDAR_TYPES } from '../model/calendar-query';
import { HEADER_ROW, INFO_BUTTON_SIZE, PHONE_TYPE_ROW } from './calendar-layout';
import { ModePills, type ModePillsProps } from './mode-pills';

function ModesInfoToggle({ type }: { type: CalendarMediaType }) {
  const { dict } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const noteId = useId();

  return (
    <>
      <Button
        isIconOnly
        variant="ghost"
        aria-label={dict.calendar.modesInfoLabel}
        aria-expanded={isOpen}
        aria-controls={noteId}
        onPress={() => setOpen((wasOpen) => !wasOpen)}
        className={cn(INFO_BUTTON_SIZE, 'text-muted')}
      >
        <Info aria-hidden className="size-4.5" />
      </Button>
      <div id={noteId} role="note" hidden={!isOpen} className="basis-full">
        <p className="max-w-xl rounded-2xl bg-surface-secondary px-3.5 py-3 text-sm leading-relaxed text-muted">
          {dict.calendar.modesInfo[type]}
        </p>
      </div>
    </>
  );
}

interface CalendarHeaderProps extends ModePillsProps {
  typeHref: (type: CalendarMediaType) => string;
  onTypeChange: (type: CalendarMediaType) => void;
}

export function CalendarHeader({ typeHref, onTypeChange, ...modePills }: CalendarHeaderProps) {
  const { dict } = useTranslation();
  const { type } = modePills;
  const options = CALENDAR_TYPES.map((option) => ({
    id: option,
    label: dict.calendar.types[option],
    href: typeHref(option),
  }));

  return (
    <div className={HEADER_ROW}>
      <h1 className="sr-only">{dict.calendar.title}</h1>
      <div className={PHONE_TYPE_ROW}>
        <SegmentedFilter
          label={dict.calendar.typeLabel}
          options={options}
          value={type}
          onChange={onTypeChange}
          isFullWidth
        />
      </div>
      <div className="contents max-md:hidden">
        <TitleSwitch
          label={dict.calendar.typeLabel}
          options={options}
          value={type}
          onSelect={onTypeChange}
        />
        <span aria-hidden className="h-7 w-px shrink-0 bg-separator" />
        <ModePills {...modePills} />
        <ModesInfoToggle type={type} />
      </div>
    </div>
  );
}
