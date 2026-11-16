'use client';

import { useId, useState } from 'react';
import { Button } from '@heroui/react';
import { Info } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { useTranslation } from '@/shared/i18n';
import { HEADER_ROW, INFO_BUTTON_SIZE, PAGE_TITLE_TEXT } from './calendar-layout';
import { ModePills, type ModePillsProps } from './mode-pills';

function ModesInfoToggle() {
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
          {dict.calendar.modesInfo}
        </p>
      </div>
    </>
  );
}

export function CalendarHeader(props: ModePillsProps) {
  const { dict } = useTranslation();

  return (
    <div className={HEADER_ROW}>
      <h1 className={PAGE_TITLE_TEXT}>{dict.calendar.title}</h1>
      <div className="contents max-md:hidden">
        <span aria-hidden className="h-7 w-px shrink-0 bg-separator" />
        <ModePills {...props} />
        <ModesInfoToggle />
      </div>
    </div>
  );
}
