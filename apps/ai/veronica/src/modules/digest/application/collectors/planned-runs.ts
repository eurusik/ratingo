import { parseExpression } from 'cron-parser';

const EVERY_PATTERN = /^every (\d+(?:\.\d+)?)s$/;
const MS_PER_SECOND = 1000;

export interface PlannedRuns {
  lastMs: number;
  previousMs: number;
}

export const plannedRuns = (
  schedule: string,
  timezone: string,
  nextRunMs: number,
  nowMs: number,
): PlannedRuns | null => {
  const every = EVERY_PATTERN.exec(schedule);
  if (every) {
    const everyMs = Number(every[1]) * MS_PER_SECOND;
    if (everyMs <= 0) return null;
    return { lastMs: nextRunMs - everyMs, previousMs: nextRunMs - 2 * everyMs };
  }
  try {
    const expression = parseExpression(schedule, { currentDate: new Date(nowMs), tz: timezone });
    const lastMs = expression.prev().getTime();
    const previousMs = expression.prev().getTime();
    return { lastMs, previousMs };
  } catch {
    return null;
  }
};
