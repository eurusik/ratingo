'use client';

import { useEffect, useEffectEvent } from 'react';
import dynamic from 'next/dynamic';
import { toast } from '@heroui/react';
import { episodeCode, type Episode } from '@/entities/episode';
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

function lastEpisode(episodes: readonly Episode[]): Episode | undefined {
  return episodes.at(-1);
}

function OpenSheet({
  show,
  episodes,
  onMark,
  onClose,
}: WatchSheetProps & { episodes: ShowEpisodes }) {
  const { dict } = useTranslation();
  const sheetShow = { ...episodes, mediaItemId: show.mediaItemId, title: show.title };
  const tracker = useEpisodesTracker(sheetShow);
  const stopAt = (episode: Episode | undefined) => {
    if (episode) onMark(show, { kind: 'stoppedAt', code: episodeCode(episode, dict) });
  };
  const startTracker: EpisodesTracker = {
    ...tracker,
    markThrough: (episode) => {
      tracker.markThrough(episode);
      stopAt(episode);
    },
    toggle: (episode, isWatched) => {
      tracker.toggle(episode, isWatched);
      if (isWatched) stopAt(episode);
    },
    markSeason: (season) => {
      tracker.markSeason(season);
      stopAt(lastEpisode(season.episodes));
    },
    catchUp: () => {
      tracker.catchUp();
      onClose();
    },
  };

  return (
    <EpisodesSheet
      show={sheetShow}
      tracker={startTracker}
      isOpen
      isPicking
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      onPickingChange={(isPicking) => {
        if (!isPicking) onClose();
      }}
      onNotStarted={() => onMark(show, NOT_STARTED)}
    />
  );
}

export function WatchSheet(props: WatchSheetProps) {
  const { dict } = useTranslation();
  const { show, onMark, onClose } = props;
  const episodes = useShowEpisodes(show.slug);
  const hasNoEpisodes = episodes.data?.seasons.length === 0;
  const settle = useEffectEvent(() => {
    if (hasNoEpisodes) {
      onMark(show, NOT_STARTED);
      return;
    }
    toast.danger(dict.settings.import.shows.failed);
    onClose();
  });

  useEffect(() => {
    if (hasNoEpisodes || episodes.isError) settle();
  }, [hasNoEpisodes, episodes.isError]);

  if (!episodes.data || hasNoEpisodes) return null;
  return <OpenSheet {...props} episodes={episodes.data} />;
}
