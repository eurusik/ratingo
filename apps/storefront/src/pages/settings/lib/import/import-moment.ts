const JUST_NOW_MS = 2 * 60 * 1000;

export function isJustNow(now: number, finishedAt: number): boolean {
  return now - finishedAt < JUST_NOW_MS;
}

export function clockTime(locale: string, at: number): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(at);
}
