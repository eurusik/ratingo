import { interpolate, type Dictionary } from '@/shared/i18n';
import type { Episode } from './season';

type EpisodeNumbers = Pick<Episode, 'seasonNumber' | 'number'>;

export function episodeCode(episode: EpisodeNumbers, dict: Dictionary): string {
  return interpolate(dict.episodes.episodeCode, {
    season: episode.seasonNumber,
    episode: episode.number,
  });
}

export const EPISODE_KEY_ATTRIBUTE = 'data-episode-key';

export function episodeKey(episode: EpisodeNumbers): string {
  return `${episode.seasonNumber}-${episode.number}`;
}

export function episodeShortCode(episode: EpisodeNumbers, dict: Dictionary): string {
  return interpolate(dict.episodes.episodeShort, { episode: episode.number });
}
