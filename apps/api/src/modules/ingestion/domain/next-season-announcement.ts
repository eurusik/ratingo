import { ShowStatus } from '@/common/enums/show-status.enum';

const FINISHED_SHOW_STATUSES: ReadonlySet<string> = new Set([
  ShowStatus.ENDED,
  ShowStatus.CANCELED,
]);

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
    !(facts.showStatus !== null && FINISHED_SHOW_STATUSES.has(facts.showStatus))
  );
}
