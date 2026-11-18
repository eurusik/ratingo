'use client';

import type { Key } from 'react';
import { Dropdown, Label, ToggleButton } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useShareLink } from '@/shared/lib';
import { useSaveToggle } from '../model/save-toggle';
import { SAVE_BUTTON_CLASS, TONE_CLASSES, type SaveButtonProps } from './save-button-look';

const MENU_KEYS = { toggle: 'toggle', open: 'open', share: 'share' } as const;

export interface SaveMenuButtonProps extends SaveButtonProps {
  autoFocus: boolean;
  defaultOpen: boolean;
}

export function SaveMenuButton({
  media,
  tone = 'surface',
  autoFocus,
  defaultOpen,
}: SaveMenuButtonProps) {
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
    <Dropdown trigger="longPress" defaultOpen={defaultOpen}>
      <ToggleButton
        autoFocus={autoFocus}
        isIconOnly
        isSelected={saved}
        onPress={toggle}
        aria-label={interpolate(dict.saveToLibrary.save, { title: media.title })}
        className={`${SAVE_BUTTON_CLASS} ${TONE_CLASSES[tone]}`}
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
