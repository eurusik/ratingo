'use client';

import { useEffect, useEffectEvent } from 'react';
import dynamic from 'next/dynamic';
import { toast } from '@heroui/react';
import {
  episodeCode,
  hasAired,
  unwatchedAired,
  unwatchedThrough,
  type Episode,
  type Season,
} from '@/entities/episode';
import { useTranslation } from '@/shared/i18n';
import { useEpisodesTracker, type EpisodesTracker } from '@/widgets/episodes-sheet';
import {
  useShowEpisodes,
  type ShowEpisodes,
  type WatchMark,
} from '@/pages/settings/model/import/imported-show-watching';
import type { RatedShow } from '@/pages/settings/model/import/rated-shows';

const loadEpisodesSheet = () =>
  import('@/widgets/episodes-sheet/index.client').then((module) => module.EpisodesSheet);

const EpisodesSheet = dynamic(loadEpisodesSheet, { ssr: false });

export function preloadEpisodesSheet(): void {
  void loadEpisodesSheet();
}

const NOT_STARTED: WatchMark = { kind: 'notStarted' };
const CAUGHT_UP: WatchMark = { kind: 'caughtUp' };

interface WatchSheetProps {
  show: RatedShow;
  onMark: (show: RatedShow, mark: WatchMark) => void;
  onClose: () => void;
}

function lastAired(season: Season, now: number): Episode | undefined {
  return season.episodes.filter((episode) => hasAired(episode, now)).at(-1);
}

function useStartTracker({
  show,
  episodes,
  onMark,
}: Omit<WatchSheetProps, 'onClose'> & { episodes: ShowEpisodes }): EpisodesTracker {
  const { dict } = useTranslation();
  const tracker = useEpisodesTracker({ ...episodes, mediaItemId: show.mediaItemId });
  const { seasons } = episodes;

  const markStop = (episode: Episode | undefined) => {
    if (!episode) return;
    const left = unwatchedAired(seasons, tracker.watched, tracker.now).length;
    const marking = unwatchedThrough(seasons, episode, tracker.watched, tracker.now).length;
    if (marking >= left) onMark(show, CAUGHT_UP);
    else onMark(show, { kind: 'stoppedAt', code: episodeCode(episode, dict) });
  };

  return {
    ...tracker,
    markThrough: (episode) => {
      markStop(episode);
      tracker.markThrough(episode);
    },
    toggle: (episode, isWatched) => {
      if (isWatched) markStop(episode);
      tracker.toggle(episode, isWatched);
    },
    markSeason: (season) => {
      markStop(lastAired(season, tracker.now));
      tracker.markSeason(season);
    },
    catchUp: () => {
      onMark(show, CAUGHT_UP);
      tracker.catchUp();
    },
  };
}

function OpenSheet(props: WatchSheetProps & { episodes: ShowEpisodes }) {
  const { show, episodes, onMark, onClose } = props;
  const tracker = useStartTracker(props);

  return (
    <EpisodesSheet
      show={{ ...episodes, mediaItemId: show.mediaItemId, slug: show.slug, title: show.title }}
      tracker={tracker}
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
  const handleUnusableEpisodes = useEffectEvent(() => {
    if (hasNoEpisodes) {
      onMark(show, NOT_STARTED);
      return;
    }
    toast.danger(dict.settings.import.shows.failed);
    onClose();
  });

  useEffect(() => {
    if (hasNoEpisodes || episodes.isError) handleUnusableEpisodes();
  }, [hasNoEpisodes, episodes.isError]);

  if (!episodes.data || hasNoEpisodes) return null;
  return <OpenSheet {...props} episodes={episodes.data} />;
}
