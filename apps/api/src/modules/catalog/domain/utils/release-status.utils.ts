import { MS_PER_DAY, NEW_RELEASE_WINDOW_DAYS } from '@/common/constants';
import { ReleaseStatus } from '@/common/enums/release-status.enum';

import { effectiveMovieReleaseDate, type MovieReleaseDates } from './movie-release.utils';

export function computeReleaseStatus(dates: MovieReleaseDates, now: Date): ReleaseStatus {
  const effectiveDate = effectiveMovieReleaseDate(dates);

  if (effectiveDate && effectiveDate > now) {
    return ReleaseStatus.UPCOMING;
  }

  const { digitalReleaseDate } = dates;
  if (digitalReleaseDate && digitalReleaseDate <= now) {
    const daysOnStreaming = (now.getTime() - digitalReleaseDate.getTime()) / MS_PER_DAY;
    return daysOnStreaming <= NEW_RELEASE_WINDOW_DAYS
      ? ReleaseStatus.NEW_ON_STREAMING
      : ReleaseStatus.STREAMING;
  }

  return effectiveDate ? ReleaseStatus.IN_THEATERS : ReleaseStatus.STREAMING;
}
