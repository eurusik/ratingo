import { NOTHING_RECORDED_NOTE } from '../../src/modules/chat/application/tools/job-failures.executor';

import { kyivDayFromEvalNow } from './eval-clock';

export const jobFailures = (
  failures: readonly Record<string, unknown>[],
  extra: Record<string, unknown> = {},
) => ({
  window: '24h',
  countedKyivDays: { from: kyivDayFromEvalNow(-1), to: kyivDayFromEvalNow(0) },
  ...extra,
  failures,
  ...(failures.length === 0 ? { note: NOTHING_RECORDED_NOTE } : {}),
});
