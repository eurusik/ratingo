import {
  findReleaseCountry,
  MovieReleaseDateKind,
  type MovieReleaseDateKindType,
  type MovieReleaseEntry,
  resolveMovieRelease,
} from '@/modules/catalog/public';
import {
  NOTIFICATION_RELEASE_KIND,
  type NotificationReleaseKind,
} from '@/modules/user-actions/domain/entities/user-notification.entity';
import { SUBSCRIPTION_TRIGGER } from '@/modules/user-actions/domain/entities/user-subscription.entity';
import {
  type MovieReleaseNotice,
  type MovieReleaseTrigger,
} from '@/modules/user-actions/domain/repositories/user-subscription.repository.interface';

export interface ClaimedMovieReleaseRow {
  id: string;
  userId: string;
  mediaItemId: string;
  theatricalReleaseDate: Date | null;
  digitalReleaseDate: Date | null;
  releaseDate: Date | null;
  releases: MovieReleaseEntry[] | null;
}

const NOTIFICATION_KIND_BY_RELEASE_KIND: Record<MovieReleaseDateKindType, NotificationReleaseKind> =
  {
    [MovieReleaseDateKind.THEATRICAL]: NOTIFICATION_RELEASE_KIND.THEATRICAL,
    [MovieReleaseDateKind.DIGITAL]: NOTIFICATION_RELEASE_KIND.DIGITAL,
  };

function digitalReleaseNotice(row: ClaimedMovieReleaseRow): MovieReleaseNotice | null {
  if (!row.digitalReleaseDate) return null;
  const digital = { date: row.digitalReleaseDate, kind: MovieReleaseDateKind.DIGITAL };
  return {
    releasedOn: row.digitalReleaseDate,
    kind: NOTIFICATION_RELEASE_KIND.DIGITAL,
    country: findReleaseCountry(digital, row.releases ?? []),
  };
}

function effectiveReleaseNotice(row: ClaimedMovieReleaseRow): MovieReleaseNotice | null {
  const resolved = resolveMovieRelease(row, row.releases);
  if (!resolved) return null;
  return {
    releasedOn: resolved.date,
    kind: NOTIFICATION_KIND_BY_RELEASE_KIND[resolved.kind],
    country: resolved.country,
  };
}

export function toMovieReleaseNotice(
  trigger: MovieReleaseTrigger,
  row: ClaimedMovieReleaseRow,
): MovieReleaseNotice | null {
  return trigger === SUBSCRIPTION_TRIGGER.ON_STREAMING
    ? digitalReleaseNotice(row)
    : effectiveReleaseNotice(row);
}
