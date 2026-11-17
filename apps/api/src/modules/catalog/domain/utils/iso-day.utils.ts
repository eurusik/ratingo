const ISO_DAY_LENGTH = 'YYYY-MM-DD'.length;

export function isoDayOf(isoTimestamp: string): string {
  return isoTimestamp.slice(0, ISO_DAY_LENGTH);
}

export function toIsoDay(date: Date): string {
  return isoDayOf(date.toISOString());
}
