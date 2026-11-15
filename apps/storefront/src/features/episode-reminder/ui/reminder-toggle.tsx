'use client';

import { Button } from '@heroui/react';
import { Bell, BellRing } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useEpisodeReminder, type ReminderShow } from '../model/episode-reminders';

type ReminderLook = 'icon' | 'text';

interface ReminderToggleProps {
  show: ReminderShow;
  look?: ReminderLook;
  className?: string;
}

export function ReminderToggle({ show, look = 'icon', className }: ReminderToggleProps) {
  const { dict } = useTranslation();
  const { isOn, toggle } = useEpisodeReminder(show);
  const Icon = isOn ? BellRing : Bell;

  return (
    <Button
      isIconOnly={look === 'icon'}
      size={look === 'icon' ? 'md' : 'sm'}
      variant={isOn ? 'secondary' : 'ghost'}
      aria-pressed={isOn}
      aria-label={
        look === 'icon' ? interpolate(dict.reminder.label, { show: show.title }) : undefined
      }
      onPress={toggle}
      className={cn(
        look === 'icon' ? 'size-11 shrink-0 rounded-full' : 'phone-tap-target gap-1.5 rounded-full',
        isOn && 'text-accent',
        className,
      )}
    >
      <Icon aria-hidden className="size-4.5" />
      {look === 'text' ? (
        <>
          {dict.reminder.remind}
          <span className="sr-only">{`: ${show.title}`}</span>
        </>
      ) : null}
    </Button>
  );
}
