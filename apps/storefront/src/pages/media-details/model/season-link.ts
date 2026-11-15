import { SHOW_SEASON_PARAM } from '@/shared/config';

export function seasonParam(search: string): string | null {
  return new URLSearchParams(search).get(SHOW_SEASON_PARAM);
}

export function linkedSeason(search: string, seasonNumbers: readonly number[]): number | undefined {
  const raw = seasonParam(search);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && seasonNumbers.includes(value) ? value : undefined;
}

export function withoutSeasonParam({
  pathname,
  search,
  hash,
}: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const params = new URLSearchParams(search);
  params.delete(SHOW_SEASON_PARAM);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}${hash}`;
}
