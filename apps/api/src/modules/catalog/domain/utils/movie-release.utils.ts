export interface MovieReleaseDates {
  releaseDate?: Date | null;
  theatricalReleaseDate?: Date | null;
  digitalReleaseDate?: Date | null;
}

export const MovieReleaseDateKind = {
  THEATRICAL: 'theatrical',
  DIGITAL: 'digital',
} as const;

export type MovieReleaseDateKindType =
  (typeof MovieReleaseDateKind)[keyof typeof MovieReleaseDateKind];

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

export function isUnreleasedMovie(dates: MovieReleaseDates, now: Date): boolean {
  const releaseDate = effectiveMovieReleaseDate(dates);
  return releaseDate !== null && releaseDate.getTime() > now.getTime();
}
