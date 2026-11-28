import { episodeKey, type Episode, type Season } from '@/entities/episode';

export interface EpisodeNeighbours {
  previous?: Episode;
  next?: Episode;
}

export function episodeNeighbours(seasons: readonly Season[], episode: Episode): EpisodeNeighbours {
  const episodes = seasons.flatMap((season) => season.episodes);
  const key = episodeKey(episode);
  const index = episodes.findIndex((candidate) => episodeKey(candidate) === key);
  if (index < 0) return {};
  return {
    previous: index > 0 ? episodes[index - 1] : undefined,
    next: episodes[index + 1],
  };
}
