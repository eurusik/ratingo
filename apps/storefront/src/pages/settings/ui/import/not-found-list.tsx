'use client';

import { formatNumber, interpolate, useTranslation } from '@/shared/i18n';
import type { MediaImportResult } from '@/shared/api';
import { withOccurrenceKeys } from '@/pages/settings/lib/import/occurrence-keys';
import { CardDisclosure } from './card-disclosure';

type NotFoundItem = MediaImportResult['details']['notFound'][number];

const itemKey = (item: NotFoundItem) => `${item.imdbId ?? item.tmdbId ?? item.title}`;

export function NotFoundList({
  items,
  isDesktop,
}: {
  items: readonly NotFoundItem[];
  isDesktop: boolean;
}) {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import.result;
  if (items.length === 0) return null;

  return (
    <CardDisclosure
      title={interpolate(copy.notFoundList, { count: formatNumber(locale, items.length) })}
      isInitiallyOpen={isDesktop}
    >
      <ul className="list-disc ps-4.5 text-sm leading-relaxed break-words text-muted md:columns-2 md:text-[15px]">
        {withOccurrenceKeys(items, itemKey).map(({ item, key }) => (
          <li key={key}>{item.title ?? item.imdbId ?? copy.untitled}</li>
        ))}
      </ul>
    </CardDisclosure>
  );
}
