import { ReleaseStatus } from '../../../../common/enums/release-status.enum';

/**
 * Computes the release status of a movie based on its release dates.
 *
 * @param releaseDate - General release date (usually theatrical)
 * @param theatricalReleaseDate - Theatrical release date
 * @param digitalReleaseDate - Digital/streaming release date
 * @returns ReleaseStatus enum value
 */
export function computeReleaseStatus(
  releaseDate: Date | null,
  theatricalReleaseDate: Date | null,
  digitalReleaseDate: Date | null,
): ReleaseStatus {
  const now = new Date();
  const effectiveTheatrical = theatricalReleaseDate ?? releaseDate;

  // Check if movie is upcoming (not released yet)
  if (effectiveTheatrical && effectiveTheatrical > now) {
    return ReleaseStatus.UPCOMING;
  }

  // Check if movie is on streaming
  if (digitalReleaseDate && digitalReleaseDate <= now) {
    // Check if it's new on streaming (within 14 days)
    const diffMs = now.getTime() - digitalReleaseDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 14) {
      return ReleaseStatus.NEW_ON_STREAMING;
    }
    return ReleaseStatus.STREAMING;
  }

  // Movie is released but not on streaming yet = in theaters
  if (effectiveTheatrical && effectiveTheatrical <= now) {
    return ReleaseStatus.IN_THEATERS;
  }

  // Fallback to streaming if we have no dates
  return ReleaseStatus.STREAMING;
}
