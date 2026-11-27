import { nothingRecordedNote } from '../../src/modules/chat/application/tools/job-failures.executor';

import { kyivDayFromEvalNow } from './eval-clock';

const filterOf = (extra: Record<string, unknown>): { job?: string; queue?: string } => ({
  ...(typeof extra.job === 'string' ? { job: extra.job } : {}),
  ...(typeof extra.queue === 'string' ? { queue: extra.queue } : {}),
});

export const jobFailures = (
  failures: readonly Record<string, unknown>[],
  extra: Record<string, unknown> = {},
) => ({
  window: '24h',
  countedKyivDays: { from: kyivDayFromEvalNow(-1), to: kyivDayFromEvalNow(0) },
  ...extra,
  failures,
  ...(failures.length === 0 ? { note: nothingRecordedNote(filterOf(extra)) } : {}),
});
