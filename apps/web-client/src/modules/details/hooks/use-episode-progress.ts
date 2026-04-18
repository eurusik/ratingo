import { useMemo } from 'react';
import type { components } from '@ratingo/api-contract';
import { useShowProgress } from '@/core/query';

type SeasonDto = components['schemas']['SeasonDto'];

export interface EpisodeProgressData {
  progressData: ReturnType<typeof useShowProgress>['data'];
  currentSeasonProgress: {
    watchedCount: number;
    totalCount: number;
    watchedEpisodeIds: string[];
    seasonNumber: number;
  } | null;
  watchedEpisodeIds: Set<string>;
  totalProgress: { watched: number; total: number };
  allEpisodesBySeasonNumber: Map<number, string[]>;
  totalEpisodesCount: number;
  totalAllEpisodes: number;
  lastAiredEpisodeInfo: { season: number; episode: number };
}

export function useEpisodeProgress(
  showId: string | undefined,
  enabled: boolean,
  validSeasons: SeasonDto[],
  selectedSeasonNumber: number | undefined,
): EpisodeProgressData {
  const { data: progressData } = useShowProgress(showId, { enabled });

  const currentSeasonProgress = progressData?.seasons.find(
    (s) => s.seasonNumber === selectedSeasonNumber
  ) ?? null;

  const watchedEpisodeIds = useMemo(
    () => new Set(currentSeasonProgress?.watchedEpisodeIds || []),
    [currentSeasonProgress?.watchedEpisodeIds],
  );

  const totalProgress = useMemo(() => {
    if (!progressData) return { watched: 0, total: 0 };
    return progressData.seasons.reduce(
      (acc, s) => ({
        watched: acc.watched + s.watchedCount,
        total: acc.total + s.totalCount,
      }),
      { watched: 0, total: 0 },
    );
  }, [progressData]);

  const { allEpisodesBySeasonNumber, totalEpisodesCount, totalAllEpisodes, lastAiredEpisodeInfo } = useMemo(() => {
    const now = Date.now();
    const map = new Map<number, string[]>();
    let airedCount = 0;
    let allCount = 0;
    let lastSeason = 0;
    let lastEpisode = 0;

    for (const season of validSeasons) {
      const episodes = season.episodes || [];
      const ids: string[] = [];
      allCount += episodes.length;

      for (const ep of episodes) {
        const airDate = ep.airDate;
        if (airDate && new Date(airDate).getTime() > now) continue;
        airedCount++;
        if (ep.id) ids.push(ep.id);
        lastSeason = season.number;
        lastEpisode = ep.number;
      }

      if (ids.length > 0) {
        map.set(season.number, ids);
      }
    }

    return {
      allEpisodesBySeasonNumber: map,
      totalEpisodesCount: airedCount,
      totalAllEpisodes: allCount,
      lastAiredEpisodeInfo: { season: lastSeason, episode: lastEpisode },
    };
  }, [validSeasons]);

  return {
    progressData,
    currentSeasonProgress,
    watchedEpisodeIds,
    totalProgress,
    allEpisodesBySeasonNumber,
    totalEpisodesCount,
    totalAllEpisodes,
    lastAiredEpisodeInfo,
  };
}
