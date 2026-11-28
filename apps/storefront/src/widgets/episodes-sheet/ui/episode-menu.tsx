'use client';

import { useMemo, type ReactNode } from 'react';
import { Dropdown, Label, type Key } from '@heroui/react';
import { Check, CheckCheck, Info, Undo2 } from 'lucide-react';
import {
  countEpisodes,
  episodeCode,
  episodeShortCode,
  episodeTitle,
  type Episode,
} from '@/entities/episode';
import { interpolate, useTranslation, type Dictionary, type Locale } from '@/shared/i18n';
import type { EpisodesTracker } from '../model/use-episodes-tracker';

export interface EpisodeMenuTarget {
  episode: Episode;
  anchor: Element;
}

type MenuAction = 'open' | 'markOnly' | 'markThrough' | 'unmark';

interface EpisodeMenuProps {
  target?: EpisodeMenuTarget;
  tracker: EpisodesTracker;
  onOpen: (episode: Episode) => void;
  onClose: () => void;
}

function rangeCaption(range: Episode[], dict: Dictionary, locale: Locale): string | undefined {
  const [first] = range;
  const last = range.at(-1);
  if (!first || !last || range.length < 2) return undefined;
  return interpolate(dict.episodes.detail.menu.markThroughCount, {
    from: episodeShortCode(first, dict),
    to: episodeShortCode(last, dict),
    episodes: countEpisodes(range.length, dict, locale),
  });
}

function MenuItemLabel({
  icon,
  text,
  caption,
}: {
  icon: ReactNode;
  text: string;
  caption?: string;
}) {
  return (
    <Label className="flex items-center gap-3">
      <span aria-hidden className="text-muted [&_svg]:size-5">
        {icon}
      </span>
      <span className="flex flex-col">
        <span>{text}</span>
        {caption ? <span className="text-[13px] text-muted">{caption}</span> : null}
      </span>
    </Label>
  );
}

export function EpisodeMenu({ target, tracker, onOpen, onClose }: EpisodeMenuProps) {
  const { dict, locale } = useTranslation();
  const labels = dict.episodes.detail.menu;
  const triggerRef = useMemo(() => ({ current: target?.anchor ?? null }), [target]);
  if (!target) return null;

  const { episode } = target;
  const isWatched = episode.id !== undefined && tracker.watched.has(episode.id);
  const caption = isWatched ? undefined : rangeCaption(tracker.rangeThrough(episode), dict, locale);

  const runAction = (key: Key) => {
    const action = key as MenuAction;
    if (action === 'open') onOpen(episode);
    if (action === 'markOnly') tracker.markOnly(episode);
    if (action === 'markThrough') tracker.toggle(episode, true);
    if (action === 'unmark') tracker.toggle(episode, false);
    onClose();
  };

  return (
    <Dropdown.Popover
      triggerRef={triggerRef}
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      placement="bottom start"
      className="min-w-64"
    >
      <Dropdown.Menu
        aria-label={interpolate(labels.label, {
          code: episodeCode(episode, dict),
          title: episodeTitle(episode, dict),
        })}
        onAction={runAction}
      >
        <Dropdown.Item id="open" textValue={labels.open}>
          <MenuItemLabel icon={<Info />} text={labels.open} />
        </Dropdown.Item>
        {isWatched ? (
          <Dropdown.Item id="unmark" textValue={labels.unmark}>
            <MenuItemLabel icon={<Undo2 />} text={labels.unmark} />
          </Dropdown.Item>
        ) : null}
        {isWatched ? null : (
          <Dropdown.Item id="markOnly" textValue={labels.markOnly}>
            <MenuItemLabel icon={<Check />} text={labels.markOnly} />
          </Dropdown.Item>
        )}
        {caption ? (
          <Dropdown.Item id="markThrough" textValue={labels.markThrough}>
            <MenuItemLabel icon={<CheckCheck />} text={labels.markThrough} caption={caption} />
          </Dropdown.Item>
        ) : null}
      </Dropdown.Menu>
    </Dropdown.Popover>
  );
}
