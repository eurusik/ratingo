import { JOB_FAILURE_DAY_TIME_ZONE } from '../constants/job-failure.constants';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JOB_FAILURE_DAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const kyivDayOf = (epochMs: number): string => {
  const parts = Object.fromEntries(
    dayFormatter.formatToParts(epochMs).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
