'use client';

import { Button } from '@heroui/react';
import { Bell, BellRing } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import {
  reminderCopy,
  useMediaReminder,
  type ReminderMedia,
  type ReminderTrigger,
} from '../model/media-reminder';

type ReminderLook = 'icon' | 'text' | 'button';

const LOOK_CLASS: Record<ReminderLook, string> = {
  icon: 'size-11 shrink-0 rounded-full',
  text: 'phone-tap-target gap-1.5 rounded-full',
  button: 'h-13 shrink-0 gap-2 rounded-full text-base font-bold max-md:w-13 max-md:px-0 md:px-5',
};

function buttonVariant(look: ReminderLook, isOn: boolean) {
  if (look === 'button') return isOn ? 'secondary' : 'outline';
  return isOn ? 'secondary' : 'ghost';
}

interface ReminderToggleProps {
  media: ReminderMedia;
  trigger?: ReminderTrigger;
  look?: ReminderLook;
  className?: string;
}

export function ReminderToggle({
  media,
  trigger = 'new_episode',
  look = 'icon',
  className,
}: ReminderToggleProps) {
  const { dict } = useTranslation();
  const { isOn, toggle } = useMediaReminder(media, trigger);
  const copy = reminderCopy(dict, trigger);
  const Icon = isOn ? BellRing : Bell;
  const isIconOnly = look === 'icon';

  return (
    <Button
      isIconOnly={isIconOnly}
      size={look === 'text' ? 'sm' : 'md'}
      variant={buttonVariant(look, isOn)}
      aria-pressed={isOn}
      aria-label={
        isIconOnly ? interpolate(isOn ? copy.on : copy.label, { title: media.title }) : undefined
      }
      onPress={toggle}
      className={cn(LOOK_CLASS[look], isOn && 'text-accent', className)}
    >
      <Icon aria-hidden className="size-4.5" />
      {isIconOnly ? null : (
        <>
          <span className={cn(look === 'button' && 'max-md:sr-only')}>
            {isOn ? copy.active : copy.remind}
          </span>
          <span className="sr-only">{`: ${media.title}`}</span>
        </>
      )}
    </Button>
  );
}
