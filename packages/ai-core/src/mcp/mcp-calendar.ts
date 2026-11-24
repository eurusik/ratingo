const MS_PER_DAY = 86_400_000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_AGO_PATTERN = /^(\d{1,5})daysAgo$/;
const TODAY = 'today';
const YESTERDAY = 'yesterday';
const DAYS_PER_ERA = 146_097;
const YEARS_PER_ERA = 400;
const DAYS_PER_YEAR = 365;
const MONTHS_FROM_MARCH = 9;
const MONTHS_PER_YEAR = 12;
const DAY_OF_YEAR_MONTH_FACTOR = 153;
const DAY_OF_YEAR_MONTH_OFFSET = 2;
const DAY_OF_YEAR_MONTH_DIVISOR = 5;
const EPOCH_ERA_OFFSET_DAYS = 719_468;
const LEAP_EVERY_YEARS = 4;
const CENTURY_YEARS = 100;
const MAX_MONTH = 12;
const MAX_DAY = 31;

export function epochDayOf(nowMs: number): number {
  return Math.floor(nowMs / MS_PER_DAY);
}

function epochDayFromCivil(year: number, month: number, day: number): number {
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor(shiftedYear / YEARS_PER_ERA);
  const yearOfEra = shiftedYear - era * YEARS_PER_ERA;
  const monthFromMarch =
    month > 2 ? month - (MONTHS_PER_YEAR - MONTHS_FROM_MARCH) : month + MONTHS_FROM_MARCH;
  const dayOfYear =
    Math.floor(
      (DAY_OF_YEAR_MONTH_FACTOR * monthFromMarch + DAY_OF_YEAR_MONTH_OFFSET) /
        DAY_OF_YEAR_MONTH_DIVISOR,
    ) +
    day -
    1;
  const dayOfEra =
    yearOfEra * DAYS_PER_YEAR +
    Math.floor(yearOfEra / LEAP_EVERY_YEARS) -
    Math.floor(yearOfEra / CENTURY_YEARS) +
    dayOfYear;
  return era * DAYS_PER_ERA + dayOfEra - EPOCH_ERA_OFFSET_DAYS;
}

function isValidCivilDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > MAX_MONTH || day < 1 || day > MAX_DAY) {
    return false;
  }
  const nextMonthStart =
    month === MAX_MONTH ? epochDayFromCivil(year + 1, 1, 1) : epochDayFromCivil(year, month + 1, 1);
  return epochDayFromCivil(year, month, day) < nextMonthStart;
}

export function daysAgoOf(value: unknown, todayEpochDay: number): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  if (value === TODAY) {
    return 0;
  }
  if (value === YESTERDAY) {
    return 1;
  }
  const relative = DAYS_AGO_PATTERN.exec(value);
  if (relative !== null) {
    return Number(relative[1]);
  }
  const absolute = ISO_DATE_PATTERN.exec(value);
  if (absolute === null) {
    return undefined;
  }
  const [year, month, day] = [Number(absolute[1]), Number(absolute[2]), Number(absolute[3])];
  return isValidCivilDate(year, month, day)
    ? todayEpochDay - epochDayFromCivil(year, month, day)
    : undefined;
}
