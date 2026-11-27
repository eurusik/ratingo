import { DumeFollowUpAction, DUME_DEADLINE_MS } from '../constants/dume.constants';
import { DumeState, type DumeFollowUp, type DumeLookup } from '../entities/dume';

export const decideDumeFollowUp = (
  followUp: Pick<DumeFollowUp, 'createdAtMs'>,
  lookup: DumeLookup | null,
  nowMs: number,
): DumeFollowUpAction => {
  const pastDeadline = nowMs - followUp.createdAtMs >= DUME_DEADLINE_MS;
  if (lookup === null) {
    return pastDeadline ? DumeFollowUpAction.GIVE_UP : DumeFollowUpAction.WAIT;
  }
  if (lookup.kind === 'not_found') return DumeFollowUpAction.NOT_FOUND;
  const finished =
    lookup.request.state === DumeState.ANSWERED || lookup.request.state === DumeState.FAILED;
  if (finished) return DumeFollowUpAction.DELIVER;
  return pastDeadline ? DumeFollowUpAction.GIVE_UP : DumeFollowUpAction.WAIT;
};
