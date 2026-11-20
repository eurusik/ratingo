import { ShowStatus } from '@/common/enums/show-status.enum';

import { type ShowPremiereFacts } from '../domain/ports/show-state.port';

const UNDATED_UNRELEASED_STATUSES: ReadonlySet<string> = new Set([
  ShowStatus.PLANNED,
  ShowStatus.IN_PRODUCTION,
  ShowStatus.PILOT,
]);

function isPremiereAhead(facts: ShowPremiereFacts, now: Date): boolean {
  if (facts.firstAirDate) return facts.firstAirDate.getTime() > now.getTime();
  return facts.status !== null && UNDATED_UNRELEASED_STATUSES.has(facts.status);
}

export function isAwaitingPremiere(facts: ShowPremiereFacts, now: Date): boolean {
  return !facts.hasAiredEpisode && isPremiereAhead(facts, now);
}
