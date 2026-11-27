import { type ScheduledEpisode } from './ports/episode-schedule.port';

export interface DedupedSchedule {
  episodes: ScheduledEpisode[];
  duplicates: string[];
}

function episodeKey(episode: ScheduledEpisode): string {
  return `S${episode.seasonNumber}E${episode.number}`;
}

function filledFields(episode: ScheduledEpisode): number {
  return [
    episode.title,
    episode.overview,
    episode.airDate,
    episode.runtime,
    episode.stillPath,
    episode.rating,
  ].filter((value) => value !== null && value !== undefined && value !== '').length;
}

export function uniqueScheduledEpisodes(episodes: readonly ScheduledEpisode[]): DedupedSchedule {
  const byKey = new Map<string, ScheduledEpisode>();
  const duplicates = new Set<string>();

  for (const episode of episodes) {
    const key = episodeKey(episode);
    const kept = byKey.get(key);
    if (!kept) {
      byKey.set(key, episode);
      continue;
    }
    duplicates.add(key);
    if (filledFields(episode) > filledFields(kept)) byKey.set(key, episode);
  }

  return { episodes: [...byKey.values()], duplicates: [...duplicates] };
}
