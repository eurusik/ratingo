'use client';

import { Button, ToggleButton } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import type { MediaSummary } from '@/entities/media';
import { useTranslation } from '@/shared/i18n';
import { useSaveToggle } from '../model/save-toggle';

const BUTTON_CLASS =
  'h-13 min-w-0 touch-manipulation gap-2 rounded-full bg-accent px-5 text-base font-bold text-accent-foreground';

type SavableMedia = Pick<MediaSummary, 'mediaItemId' | 'title'>;

interface WantToWatchButtonProps {
  media: SavableMedia;
  className?: string;
}

export function WantToWatchButton({ media, className = '' }: WantToWatchButtonProps) {
  const { dict } = useTranslation();
  const { saved, toggle } = useSaveToggle(media);
  const Icon = saved ? Check : Plus;

  return (
    <ToggleButton
      isSelected={saved}
      onPress={toggle}
      className={`${BUTTON_CLASS} data-[selected=true]:bg-default data-[selected=true]:text-foreground ${className}`}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="truncate">{dict.saveToLibrary.wantToWatch}</span>
    </ToggleButton>
  );
}

interface SaveToWatchCtaProps {
  media: SavableMedia;
  label: string;
  className?: string;
}

export function SaveToWatchCta({ media, label, className = '' }: SaveToWatchCtaProps) {
  const { toggle } = useSaveToggle(media);

  return (
    <Button onPress={toggle} className={`${BUTTON_CLASS} ${className}`}>
      <span className="truncate">{label}</span>
    </Button>
  );
}
