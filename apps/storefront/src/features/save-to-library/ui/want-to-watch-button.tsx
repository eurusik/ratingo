'use client';

import { ToggleButton } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import type { MediaSummary } from '@/entities/media';
import { useTranslation } from '@/shared/i18n';
import { useSaveToggle } from '../model/save-toggle';

interface WantToWatchButtonProps {
  media: Pick<MediaSummary, 'mediaItemId' | 'title'>;
  label?: string;
  className?: string;
}

export function WantToWatchButton({ media, label, className }: WantToWatchButtonProps) {
  const { dict } = useTranslation();
  const { saved, toggle } = useSaveToggle(media);
  const Icon = saved ? Check : Plus;

  return (
    <ToggleButton
      isSelected={saved}
      onPress={toggle}
      className={`h-13 min-w-0 touch-manipulation gap-2 rounded-full bg-accent px-5 text-base font-bold text-accent-foreground data-[selected=true]:bg-default data-[selected=true]:text-foreground ${className ?? ''}`}
    >
      {label && !saved ? null : <Icon aria-hidden className="size-5 shrink-0" />}
      <span className="truncate">
        {saved ? dict.saveToLibrary.wantToWatch : (label ?? dict.saveToLibrary.wantToWatch)}
      </span>
    </ToggleButton>
  );
}
