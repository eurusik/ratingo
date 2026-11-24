import { ShowStatus } from '@/common/enums/show-status.enum';
import { type NormalizedMedia, type NormalizedSeason } from '@/modules/shared/contracts';

export const SPECIALS_SEASON_NUMBER = 0;

export interface ShowPremiereFacts {
  firstAirDate: Date | null;
  status: string | null;
  hasAiredEpisode: boolean;
}

export const UNDATED_UNRELEASED_SHOW_STATUSES: readonly string[] = [
  ShowStatus.PLANNED,
  ShowStatus.IN_PRODUCTION,
  ShowStatus.PILOT,
];

const UNDATED_UNRELEASED_STATUSES: ReadonlySet<string> = new Set(UNDATED_UNRELEASED_SHOW_STATUSES);

function isPremiereAhead(facts: ShowPremiereFacts, now: Date): boolean {
  if (facts.firstAirDate) return facts.firstAirDate.getTime() > now.getTime();
  return facts.status !== null && UNDATED_UNRELEASED_STATUSES.has(facts.status);
}

export function isAwaitingPremiere(facts: ShowPremiereFacts, now: Date): boolean {
  return !facts.hasAiredEpisode && isPremiereAhead(facts, now);
}

function hasAiredRegularEpisode(seasons: readonly NormalizedSeason[], now: Date): boolean {
  return seasons.some(
    (season) =>
      season.number > SPECIALS_SEASON_NUMBER &&
      season.episodes.some((episode) => episode.airDate && episode.airDate <= now),
  );
}

export function premiereFactsOf(media: NormalizedMedia, now: Date): ShowPremiereFacts {
  return {
    firstAirDate: media.releaseDate ?? null,
    status: media.details?.status ?? media.status ?? null,
    hasAiredEpisode: hasAiredRegularEpisode(media.details?.seasons ?? [], now),
  };
}
