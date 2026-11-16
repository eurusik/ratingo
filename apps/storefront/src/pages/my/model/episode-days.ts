const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseAirDate(airDate: string): number {
  const dateOnly = DATE_ONLY.exec(airDate);
  if (!dateOnly) return Date.parse(airDate);
  return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])).getTime();
}

function startOfDay(at: number): number {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

export function daysFromToday(airDate: string, now: number): number {
  return Math.round((startOfDay(parseAirDate(airDate)) - startOfDay(now)) / DAY_MS);
}
