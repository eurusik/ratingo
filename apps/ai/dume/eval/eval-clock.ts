const MS_PER_MINUTE = 60_000;

export const EVAL_NOW_MS = Date.UTC(2026, 10, 27, 9, 0, 0);

export const minutesAgoMs = (minutes: number): number => EVAL_NOW_MS - minutes * MS_PER_MINUTE;

const kyivDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const kyivDayOf = (epochMs: number): string => kyivDay.format(epochMs);
