'use client';

import { Button } from '@heroui/react';
import { Flag } from 'lucide-react';
import {
  countEpisodes,
  episodeCode,
  unwatchedThrough,
  type Episode,
  type Season,
} from '@/entities/episode';
import { interpolate, useTranslation } from '@/shared/i18n';
import { isBehind } from '../model/season-status';
import type { EpisodesShow, EpisodesTracker } from '../model/use-episodes-tracker';
import { NoticeBar } from './notice-bar';

interface SheetFooterProps {
  show: EpisodesShow;
  season: Season;
  tracker: EpisodesTracker;
  isPicking: boolean;
  pickTarget?: Episode;
  onStartPicking: () => void;
  onConfirmPick: () => void;
}

function PickConfirm({ show, tracker, pickTarget, onConfirmPick }: SheetFooterProps) {
  const { dict, locale } = useTranslation();
  if (!pickTarget) return null;
  const count = unwatchedThrough(show.seasons, pickTarget, tracker.watched, tracker.now).length;

  return (
    <Button
      variant="primary"
      onPress={onConfirmPick}
      className="h-14 w-full rounded-full text-base font-bold"
    >
      {interpolate(dict.episodes.pick.confirm, {
        episodes: countEpisodes(count, dict, locale),
        code: episodeCode(pickTarget, dict),
      })}
    </Button>
  );
}

export function SheetFooter(props: SheetFooterProps) {
  const { dict } = useTranslation();
  const { show, season, tracker, isPicking, onStartPicking } = props;
  const offersPick =
    !isPicking && !tracker.notice && isBehind(show.seasons, season, tracker.watched, tracker.now);

  return (
    <>
      {isPicking ? <PickConfirm {...props} /> : null}
      <NoticeBar tracker={tracker} className={isPicking ? 'hidden' : 'w-full'} />
      {offersPick ? (
        <Button
          variant="secondary"
          onPress={onStartPicking}
          className="h-13 w-full gap-2 rounded-full text-[15px] font-bold"
        >
          <Flag aria-hidden className="size-4.5" />
          {dict.episodes.menu.pickUntil}
        </Button>
      ) : null}
    </>
  );
}
