'use client';

import { CALENDAR_PREMIERES_ROUTE } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { track } from '@/shared/lib';
import type { PremiereRelease } from '../model/home-feed';
import { CalendarTile } from './calendar-tile';
import { ReleaseRail } from './release-rail';

export function AnticipatedPremieres({ premieres }: { premieres: PremiereRelease[] }) {
  const { dict } = useTranslation();

  if (premieres.length === 0) return null;

  return (
    <ReleaseRail
      sectionId="anticipated-premieres"
      title={dict.home.premieres}
      caption={dict.home.premieresCaption}
      dateLabel={dict.home.premiereDate}
      origin="home_premieres"
      items={premieres.map((premiere) => ({
        media: {
          mediaItemId: premiere.mediaItemId,
          title: premiere.title,
          slug: premiere.slug,
          type: 'show',
        },
        posterUrl: premiere.posterUrl,
        date: premiere.premiereDate,
        note: { text: dict.home.premiereKind[premiere.kind], tone: 'accent' },
      }))}
      endItem={
        <CalendarTile
          href={CALENDAR_PREMIERES_ROUTE}
          label={dict.home.upcomingMore}
          onOpen={() => track('calendar_open', { origin: 'home_premieres' })}
        />
      }
    />
  );
}
