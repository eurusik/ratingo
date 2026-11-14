'use client';

import { Button, Dropdown, type Key } from '@heroui/react';
import { Ellipsis, X } from 'lucide-react';
import { countEpisodes } from '@/entities/episode';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { EpisodesTracker } from '../model/use-episodes-tracker';

export type MenuAction = 'pick' | 'catchUp' | 'reset' | 'resetAll';

interface SheetHeadingProps {
  title: string;
  tracker: EpisodesTracker;
  disabledActions: MenuAction[];
  onMenuAction: (action: MenuAction) => void;
  onClose: () => void;
}

export function SheetHeading({
  title,
  tracker,
  disabledActions,
  onMenuAction,
  onClose,
}: SheetHeadingProps) {
  const { dict, locale } = useTranslation();
  const { watched, aired } = tracker.summary;
  const subtitle = interpolate(dict.episodes.showProgress, {
    title,
    watched,
    episodes: countEpisodes(aired, dict, locale),
  });

  return (
    <div className="flex items-center gap-2.5">
      <div className="min-w-0 flex-1">
        <p aria-hidden className="text-[22px] font-extrabold tracking-tight">
          {dict.episodes.title}
        </p>
        <p className="truncate text-sm text-muted tabular-nums">{subtitle}</p>
      </div>
      <Dropdown>
        <Button
          isIconOnly
          variant="tertiary"
          aria-label={dict.episodes.menu.label}
          className="size-11 rounded-full"
        >
          <Ellipsis aria-hidden className="size-5" />
        </Button>
        <Dropdown.Popover placement="bottom end" className="min-w-64">
          <Dropdown.Menu
            aria-label={dict.episodes.menu.label}
            disabledKeys={disabledActions}
            onAction={(key: Key) => onMenuAction(key as MenuAction)}
          >
            <Dropdown.Item id="pick" textValue={dict.episodes.menu.pickUntil}>
              {dict.episodes.menu.pickUntil}
            </Dropdown.Item>
            <Dropdown.Item id="catchUp" textValue={dict.episodes.menu.catchUp}>
              {dict.episodes.menu.catchUp}
            </Dropdown.Item>
            <Dropdown.Item id="reset" variant="danger" textValue={dict.episodes.menu.resetSeason}>
              {dict.episodes.menu.resetSeason}
            </Dropdown.Item>
            <Dropdown.Item id="resetAll" variant="danger" textValue={dict.episodes.menu.resetAll}>
              {dict.episodes.menu.resetAll}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <Button
        isIconOnly
        variant="tertiary"
        aria-label={dict.common.close}
        onPress={onClose}
        className="size-11 rounded-full"
      >
        <X aria-hidden className="size-5" />
      </Button>
    </div>
  );
}
