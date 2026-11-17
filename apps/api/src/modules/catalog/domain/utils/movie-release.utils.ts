import { FALLBACK_REGION, PRIMARY_REGION } from '@/common/constants/region.constants';

import {
  MovieReleaseDateKind,
  type MovieReleaseDateKindType,
} from '../constants/movie-release.constants';

import { isoDayOf, toIsoDay } from './iso-day.utils';

export interface MovieReleaseDates {
  releaseDate?: Date | null;
  theatricalReleaseDate?: Date | null;
  digitalReleaseDate?: Date | null;
}

export interface EffectiveMovieRelease {
  date: Date;
  kind: MovieReleaseDateKindType;
}

export function effectiveMovieRelease(dates: MovieReleaseDates): EffectiveMovieRelease | null {
  if (dates.theatricalReleaseDate) {
    return { date: dates.theatricalReleaseDate, kind: MovieReleaseDateKind.THEATRICAL };
  }
  if (dates.digitalReleaseDate) {
    return { date: dates.digitalReleaseDate, kind: MovieReleaseDateKind.DIGITAL };
  }
  if (dates.releaseDate) {
    return { date: dates.releaseDate, kind: MovieReleaseDateKind.THEATRICAL };
  }
  return null;
}

export function effectiveMovieReleaseDate(dates: MovieReleaseDates): Date | null {
  return effectiveMovieRelease(dates)?.date ?? null;
}

export function isMovieReleasingFrom(dates: MovieReleaseDates, day: Date): boolean {
  const releaseDate = effectiveMovieReleaseDate(dates);
  return releaseDate !== null && releaseDate.getTime() >= day.getTime();
}

export interface MovieReleaseEntry {
  country: string;
  type: number;
  date: string;
}

export interface MovieRelease extends EffectiveMovieRelease {
  country: string | null;
}

const TMDB_RELEASE_TYPE_BY_KIND: Record<MovieReleaseDateKindType, number> = {
  [MovieReleaseDateKind.THEATRICAL]: 3,
  [MovieReleaseDateKind.DIGITAL]: 4,
};

const RELEASE_COUNTRY_PREFERENCE = [PRIMARY_REGION, FALLBACK_REGION];

function findReleaseCountry(
  release: EffectiveMovieRelease,
  releases: readonly MovieReleaseEntry[],
): string | null {
  const releaseDay = toIsoDay(release.date);
  const matching = releases.filter(
    (entry) =>
      entry.type === TMDB_RELEASE_TYPE_BY_KIND[release.kind] && isoDayOf(entry.date) === releaseDay,
  );
  const preferred = RELEASE_COUNTRY_PREFERENCE.find((country) =>
    matching.some((entry) => entry.country === country),
  );
  return preferred ?? matching.at(0)?.country ?? null;
}

export function resolveMovieRelease(
  dates: MovieReleaseDates,
  releases: readonly MovieReleaseEntry[] | null,
): MovieRelease | null {
  const release = effectiveMovieRelease(dates);
  if (!release) return null;
  return { ...release, country: findReleaseCountry(release, releases ?? []) };
}
