const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const utcDayIndex = (nowMs: number): number => Math.floor(nowMs / MS_PER_DAY);

export const utcDayStartMs = (nowMs: number): number => utcDayIndex(nowMs) * MS_PER_DAY;

export const utcDayKey = (nowMs: number): string => `day${utcDayIndex(nowMs)}`;
