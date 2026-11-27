const KYIV_TIME_ZONE = 'Europe/Kyiv';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KYIV_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const kyivDateOf = (epochMs: number): string => formatter.format(epochMs);
