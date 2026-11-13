'use client';

import type { Key } from 'react';
import { Dropdown, Label, ToggleButton } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import type { MediaSummary } from '@/entities/media';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useShareLink } from '@/shared/lib';
import { useSaveToggle } from '../model/save-toggle';

type SaveButtonTone = 'surface' | 'overlay';

const TONE_CLASSES: Record<SaveButtonTone, string> = {
  surface: '',
  overlay: 'bg-black/80 text-white',
};

const MENU_KEYS = { toggle: 'toggle', open: 'open', share: 'share' } as const;

interface SaveButtonProps {
  media: Pick<MediaSummary, 'mediaItemId' | 'title' | 'type' | 'slug'>;
  tone?: SaveButtonTone;
}

export function SaveButton({ media, tone = 'surface' }: SaveButtonProps) {
  const { dict } = useTranslation();
  const share = useShareLink();
  const { saved, toggle } = useSaveToggle(media);
  const href = mediaRoute(media.type, media.slug);
  const toggleLabel = saved ? dict.saveToLibrary.menu.unsave : dict.saveToLibrary.menu.save;

  const onMenuAction = (key: Key) => {
    if (key === MENU_KEYS.toggle) toggle();
    if (key === MENU_KEYS.share) void share({ href, title: media.title });
  };

  return (
    <Dropdown trigger="longPress">
      <ToggleButton
        isIconOnly
        isSelected={saved}
        onPress={toggle}
        aria-label={interpolate(dict.saveToLibrary.save, { title: media.title })}
        className={`size-11 shrink-0 touch-manipulation rounded-full select-none [-webkit-touch-callout:none] data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground ${TONE_CLASSES[tone]}`}
      >
        {saved ? <Check aria-hidden className="size-5" /> : <Plus aria-hidden className="size-5" />}
      </ToggleButton>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu onAction={onMenuAction}>
          <Dropdown.Item id={MENU_KEYS.toggle} textValue={toggleLabel}>
            <Label>{toggleLabel}</Label>
          </Dropdown.Item>
          <Dropdown.Item id={MENU_KEYS.open} href={href} textValue={dict.saveToLibrary.menu.open}>
            <Label>{dict.saveToLibrary.menu.open}</Label>
          </Dropdown.Item>
          <Dropdown.Item id={MENU_KEYS.share} textValue={dict.saveToLibrary.menu.share}>
            <Label>{dict.saveToLibrary.menu.share}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
