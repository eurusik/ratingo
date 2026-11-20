'use client';

import { useTranslation } from '@/shared/i18n';
import type { UpcomingRelease } from '../model/home-feed';
import { ReleaseRail } from './release-rail';

export function UpcomingMovies({ releases }: { releases: UpcomingRelease[] }) {
  const { dict } = useTranslation();

  if (releases.length === 0) return null;

  return (
    <ReleaseRail
      sectionId="upcoming-movies"
      title={dict.home.upcoming}
      caption={dict.home.upcomingCaption}
      dateLabel={dict.home.upcomingDate}
      calendarType="movie"
      origin="home_upcoming"
      items={releases.map((release) => ({
        media: {
          mediaItemId: release.mediaItemId,
          title: release.title,
          slug: release.slug,
          type: 'movie',
        },
        posterUrl: release.posterUrl,
        date: release.releaseDate,
        note: dict.release[release.kind],
      }))}
    />
  );
}
