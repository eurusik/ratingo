import type { JobSchedule } from '../entities/system-card';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_PER_WEEK = WEEKDAYS.length;
const SUNDAY_ALIAS = 7;
const MAX_MINUTE = 59;
const MAX_HOUR = 23;
const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1000;
const CRON_FIELD_COUNT = 5;
const WILDCARD = '*';
const STEP_PATTERN = /^\*\/(\d{1,2})$/;
const NUMBER_PATTERN = /^\d{1,2}$/;
const RANGE_PATTERN = /^(\d{1,2})-(\d{1,2})$/;
const EVERY_SECONDS_LABEL = /^every (\d+)s$/;

export const CUSTOM_CADENCE = 'on a custom schedule';

type Frequency = { timesPerDay: number } | { everyHours: number } | { everyMinutes: number };

const expandList = (field: string, max: number): number[] | null => {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const range = RANGE_PATTERN.exec(part);
    const single = NUMBER_PATTERN.test(part) ? Number(part) : null;
    const from = range === null ? single : Number(range[1]);
    const to = range === null ? single : Number(range[2]);
    if (from === null || to === null || from > to || to > max) return null;
    for (let value = from; value <= to; value += 1) values.add(value);
  }
  return [...values].sort((a, b) => a - b);
};

const stepOf = (field: string, max: number): number | null => {
  const match = STEP_PATTERN.exec(field);
  const step = match === null ? null : Number(match[1]);
  return step !== null && step >= 1 && step <= max ? step : null;
};

const frequencyOf = (minute: string, hour: string): Frequency | null => {
  const minuteStep = stepOf(minute, MAX_MINUTE);
  if (minute === WILDCARD && hour === WILDCARD) return { everyMinutes: 1 };
  if (minuteStep !== null) return hour === WILDCARD ? { everyMinutes: minuteStep } : null;
  if (expandList(minute, MAX_MINUTE)?.length !== 1) return null;
  if (hour === WILDCARD) return { everyHours: 1 };
  const hourStep = stepOf(hour, MAX_HOUR);
  if (hourStep !== null) return { everyHours: hourStep };
  const hours = expandList(hour, MAX_HOUR);
  return hours === null ? null : { timesPerDay: hours.length };
};

const weekdaysOf = (field: string): number[] | null => {
  if (field === WILDCARD) return WEEKDAYS.map((_, day) => day);
  const days = expandList(field, SUNDAY_ALIAS);
  return days === null
    ? null
    : [...new Set(days.map((day) => day % DAYS_PER_WEEK))].sort((a, b) => a - b);
};

const plural = (count: number, unit: string): string =>
  count === 1 ? `every ${unit}` : `every ${count} ${unit}s`;

const frequencyWords = (frequency: Frequency): string => {
  if ('everyMinutes' in frequency) return plural(frequency.everyMinutes, 'minute');
  if ('everyHours' in frequency) return plural(frequency.everyHours, 'hour');
  if (frequency.timesPerDay === 1) return 'once a day';
  if (frequency.timesPerDay === 2) return 'twice a day';
  return `${frequency.timesPerDay} times a day`;
};

const joinDays = (days: readonly number[]): string => {
  const names = days.map((day) => WEEKDAYS[day]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
};

const isOncePerDay = (frequency: Frequency): boolean =>
  'timesPerDay' in frequency && frequency.timesPerDay === 1;

const cadenceWords = (frequency: Frequency, days: readonly number[]): string => {
  const once = isOncePerDay(frequency);
  const often = frequencyWords(frequency);
  if (days.length === DAYS_PER_WEEK) return once ? 'daily' : often;
  if (days.length === 1)
    return once ? `weekly on ${joinDays(days)}` : `${often} on ${joinDays(days)}`;
  const skipped = WEEKDAYS.map((_, day) => day).filter((day) => !days.includes(day));
  if (skipped.length === 1) {
    return once ? `daily except ${joinDays(skipped)}` : `${often} except on ${joinDays(skipped)}`;
  }
  return once ? `on ${joinDays(days)}` : `${often} on ${joinDays(days)}`;
};

const describeCron = (pattern: string): string => {
  const fields = pattern.trim().split(/\s+/);
  if (fields.length !== CRON_FIELD_COUNT) return CUSTOM_CADENCE;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (dayOfMonth !== WILDCARD || month !== WILDCARD) return CUSTOM_CADENCE;
  const frequency = frequencyOf(minute, hour);
  const days = weekdaysOf(dayOfWeek);
  if (frequency === null || days === null || days.length === 0) return CUSTOM_CADENCE;
  return cadenceWords(frequency, days);
};

const describeInterval = (everyMs: number): string => {
  if (!Number.isInteger(everyMs) || everyMs <= 0 || everyMs % MS_PER_MINUTE !== 0) {
    return CUSTOM_CADENCE;
  }
  const minutes = everyMs / MS_PER_MINUTE;
  return minutes % MINUTES_PER_HOUR === 0
    ? plural(minutes / MINUTES_PER_HOUR, 'hour')
    : plural(minutes, 'minute');
};

export const describeCadence = (schedule: JobSchedule): string =>
  'cron' in schedule ? describeCron(schedule.cron) : describeInterval(schedule.everyMs);

export const scheduleFromLabel = (label: string): JobSchedule => {
  const interval = EVERY_SECONDS_LABEL.exec(label);
  return interval === null ? { cron: label } : { everyMs: Number(interval[1]) * MS_PER_SECOND };
};
