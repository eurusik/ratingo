const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const utcDayKey = (nowMs: number): string => `day${Math.floor(nowMs / MS_PER_DAY)}`;
