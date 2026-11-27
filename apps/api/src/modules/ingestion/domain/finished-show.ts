import { ShowStatus } from '@/common/enums/show-status.enum';

const FINISHED_SHOW_STATUSES: ReadonlySet<string> = new Set([
  ShowStatus.ENDED,
  ShowStatus.CANCELED,
]);

export function isFinishedShow(showStatus: string | null): boolean {
  return showStatus !== null && FINISHED_SHOW_STATUSES.has(showStatus);
}
