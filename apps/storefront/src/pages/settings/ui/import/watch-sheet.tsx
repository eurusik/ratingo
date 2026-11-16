'use client';

import { useEffect, useEffectEvent } from 'react';
import dynamic from 'next/dynamic';
import { episodeCode } from '@/entities/episode';
import { useTranslation } from '@/shared/i18n';
import { useEpisodesTracker, type EpisodesTracker } from '@/widgets/episodes-sheet';
import {
  useShowEpisodes,
  type ShowEpisodes,
  type WatchMark,
} from '@/pages/settings/model/import/imported-show-watching';
import type { RatedShow } from '@/pages/settings/model/import/rated-shows';

const EpisodesSheet = dynamic(
  () => import('@/widgets/episodes-sheet/index.client').then((module) => module.EpisodesSheet),
  { ssr: false },
);

const NOT_STARTED: WatchMark = { kind: 'notStarted' };

interface WatchSheetProps {
  show: RatedShow;
  onMark: (show: RatedShow, mark: WatchMark) => void;
  onClose: () => void;
}

function OpenSheet({ show, episodes, onMark, onClose }: WatchSheetProps & { episodes: ShowEpisodes }) {
  const { dict } = useTranslation();
  const sheetShow = { ...episodes, mediaItemId: show.mediaItemId, title: show.title };
  const tracker = useEpisodesTracker(sheetShow);
  const importTracker: EpisodesTracker = {
    ...tracker,
    markThrough: (episode) => {
      tracker.markThrough(episode);
      onMark(show, { kind: 'stoppedAt', code: episodeCode(episode, dict) });
    },
  };

  return (
    <EpisodesSheet
      show={sheetShow}
      tracker={importTracker}
      isOpen
      isPicking
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      onPickingChange={() => undefined}
      onNotStarted={() => onMark(show, NOT_STARTED)}
    />
  );
}

export function WatchSheet(props: WatchSheetProps) {
  const { show, onMark } = props;
  const episodes = useShowEpisodes(show.slug);
  const hasNoEpisodes = episodes.isError || episodes.data?.seasons.length === 0;

  const startWithoutEpisodes = useEffectEvent(() => onMark(show, NOT_STARTED));

  useEffect(() => {
    if (hasNoEpisodes) startWithoutEpisodes();
  }, [hasNoEpisodes]);

  if (!episodes.data || hasNoEpisodes) return null;
  return <OpenSheet {...props} episodes={episodes.data} />;
}
