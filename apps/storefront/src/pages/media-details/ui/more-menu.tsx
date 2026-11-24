'use client';

import { Dropdown, Label, type Key } from '@heroui/react';
import { Ellipsis, Share, Trash2 } from 'lucide-react';
import { useMediaState } from '@/entities/library';
import { useRemoveFromLibrary } from '@/features/remove-from-library';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useShareLink } from '@/shared/lib';
import type { ActionMedia } from '../model/action-media';
import { HERO_GLASS_BUTTON } from './hero-glass';

const MENU_KEYS = { share: 'share', remove: 'remove' } as const;

export type MoreMenuMedia = Pick<ActionMedia, 'mediaItemId' | 'type' | 'slug' | 'title'>;

interface MoreMenuProps {
  media: MoreMenuMedia;
  className: string;
}

export function MoreMenu({ media, className }: MoreMenuProps) {
  const { dict } = useTranslation();
  const share = useShareLink();
  const remove = useRemoveFromLibrary();
  const { mediaState } = useMediaState(media.mediaItemId);
  const label = interpolate(dict.details.more, { title: media.title });

  const onAction = (key: Key) => {
    if (key === MENU_KEYS.share) {
      void share({ href: mediaRoute(media.type, media.slug), title: media.title });
    }
    if (key === MENU_KEYS.remove) remove(media);
  };

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={label}
        className={`items-center justify-center rounded-full text-foreground outline-none focus-visible:outline-2 focus-visible:outline-focus ${className}`}
      >
        <Ellipsis aria-hidden className="size-5.5" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-56">
        <Dropdown.Menu aria-label={label} onAction={onAction}>
          <Dropdown.Item id={MENU_KEYS.share} textValue={dict.details.share}>
            <Share aria-hidden className="size-4.5" />
            <Label>{dict.details.share}</Label>
          </Dropdown.Item>
          {mediaState ? (
            <Dropdown.Item id={MENU_KEYS.remove} textValue={dict.library.remove} variant="danger">
              <Trash2 aria-hidden className="size-4.5" />
              <Label>{dict.library.remove}</Label>
            </Dropdown.Item>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export function DesktopMoreMenu({ media }: { media: MoreMenuMedia }) {
  return (
    <MoreMenu media={media} className={`hidden size-13 shrink-0 md:flex ${HERO_GLASS_BUTTON}`} />
  );
}
