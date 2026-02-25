'use client';

import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/shared/i18n';
import { LinkToggleGroup } from '@/shared/ui';

export function TrendingToggle() {
  const { dict } = useTranslation();
  const pathname = usePathname();
  const value = pathname.startsWith('/browse/movies')
    ? 'movies'
    : pathname.startsWith('/calendar')
      ? 'calendar'
      : 'shows';

  return (
    <LinkToggleGroup
      items={[
        { value: 'shows', label: dict.nav.shows, href: '/browse/shows-trending' as Route },
        { value: 'movies', label: dict.nav.movies, href: '/browse/movies-trending' as Route },
        { value: 'calendar', label: dict.nav.calendar, href: '/calendar' as Route },
      ]}
      value={value}
      shape="pill"
    />
  );
}
