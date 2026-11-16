'use client';

import { Disclosure } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { MediaImportResult } from '@/shared/api';
import { withOccurrenceKeys } from '@/pages/settings/model/import/occurrence-keys';

type NotFoundItem = MediaImportResult['details']['notFound'][number];

const itemKey = (item: NotFoundItem) => `${item.imdbId ?? item.tmdbId ?? item.title}`;

export function NotFoundList({
  items,
  isDesktop,
}: {
  items: readonly NotFoundItem[];
  isDesktop: boolean;
}) {
  const { dict } = useTranslation();
  const copy = dict.settings.import.result;
  if (items.length === 0) return null;

  return (
    <Disclosure
      defaultExpanded={isDesktop}
      className="rounded-[20px] bg-surface px-4 py-1 md:px-5 [&_.disclosure\_\_body]:p-0"
    >
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex min-h-12 w-full items-center justify-between gap-3 text-start text-[15px] font-bold md:min-h-13 md:text-base">
          {interpolate(copy.notFoundList, { count: items.length })}
          <Disclosure.Indicator className="text-muted" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          <ul className="mb-3 list-disc ps-4.5 text-sm leading-relaxed text-muted md:mb-4 md:columns-2 md:text-[15px]">
            {withOccurrenceKeys(items, itemKey).map(({ item, key }) => (
              <li key={key}>{item.title ?? item.imdbId ?? copy.untitled}</li>
            ))}
          </ul>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
