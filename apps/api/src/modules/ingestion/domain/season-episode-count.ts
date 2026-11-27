import { isFinishedShow } from './finished-show';

export interface SeasonEpisodeCountSources {
  listedEpisodes: number;
  announcedEpisodes: number | undefined;
  showStatus: string | null;
  isLatestSeason: boolean;
}

export function seasonEpisodeCount({
  listedEpisodes,
  announcedEpisodes,
  showStatus,
  isLatestSeason,
}: SeasonEpisodeCountSources): number {
  const mayStillBeListing = isLatestSeason && !isFinishedShow(showStatus);
  if (!mayStillBeListing) return listedEpisodes;
  return Math.max(listedEpisodes, announcedEpisodes ?? 0);
}
