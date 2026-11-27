import { isFinishedShow } from './finished-show';

export interface UnknownSeasonFacts {
  seasonNumber: number;
  lastKnownSeasonNumber: number;
  showStatus: string | null;
  hasDatedEpisode: boolean;
}

export function isAnnouncedNextSeason(facts: UnknownSeasonFacts): boolean {
  return (
    facts.seasonNumber === facts.lastKnownSeasonNumber + 1 &&
    facts.hasDatedEpisode &&
    !isFinishedShow(facts.showStatus)
  );
}
