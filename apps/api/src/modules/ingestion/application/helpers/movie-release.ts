export interface MovieReleaseDates {
  releaseDate?: Date | null;
  theatricalReleaseDate?: Date | null;
  digitalReleaseDate?: Date | null;
}

export function effectiveMovieReleaseDate(dates: MovieReleaseDates): Date | null {
  return dates.theatricalReleaseDate ?? dates.digitalReleaseDate ?? dates.releaseDate ?? null;
}

export function isUnreleasedMovie(dates: MovieReleaseDates, now: Date): boolean {
  const releaseDate = effectiveMovieReleaseDate(dates);
  return releaseDate !== null && releaseDate.getTime() > now.getTime();
}
