import {
  NEW_RELEASE_THRESHOLDS,
  CLASSIC_THRESHOLDS,
} from '../../../domain/constants/catalog.constants';

/**
 * Release status flags for media items.
 */
export interface ReleaseFlags {
  isNew: boolean;
  isClassic: boolean;
}

/**
 * Calculates isNew and isClassic flags for a media item.
 * Centralizes the logic used across trending queries.
 *
 * @param releaseDate - Media release date
 * @param ratingoScore - Optional ratingo score for classic detection
 * @param totalWatchers - Optional total watchers for classic detection
 * @param now - Reference date (defaults to current date)
 */
export function calculateReleaseFlags(
  releaseDate: Date | null,
  ratingoScore?: number | null,
  totalWatchers?: number | null,
  now: Date = new Date(),
): ReleaseFlags {
  if (!releaseDate) {
    return { isNew: false, isClassic: false };
  }

  const newReleaseCutoff = new Date(now);
  newReleaseCutoff.setDate(now.getDate() - NEW_RELEASE_THRESHOLDS.DAYS);

  const classicCutoff = new Date(now);
  classicCutoff.setFullYear(now.getFullYear() - CLASSIC_THRESHOLDS.YEARS_OLD);

  const isNew = releaseDate >= newReleaseCutoff;

  // Classic by age OR by high quality + engagement
  const isClassic =
    releaseDate <= classicCutoff ||
    ((ratingoScore ?? 0) >= CLASSIC_THRESHOLDS.RATINGO_SCORE &&
      (totalWatchers ?? 0) > CLASSIC_THRESHOLDS.TOTAL_WATCHERS);

  return { isNew, isClassic };
}
