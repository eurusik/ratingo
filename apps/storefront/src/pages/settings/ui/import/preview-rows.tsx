'use client';

import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { ImportItem } from '@/pages/settings/model/import/import-item';
import { withOccurrenceKeys } from '@/pages/settings/model/import/occurrence-keys';
import { formatOwnRating } from '@/pages/settings/model/import/rating-label';

const itemKey = (item: ImportItem) => `${item.state}:${item.imdbId ?? item.tmdbId ?? item.title}`;

function useRowCopy() {
  const { dict, locale } = useTranslation();
  const copy = dict.settings.import;

  return {
    title: (item: ImportItem) => item.title ?? item.imdbId ?? copy.result.untitled,
    meta: (item: ImportItem) =>
      [item.kind ? copy.preview[item.kind] : undefined, item.year].filter(Boolean).join(' · '),
    tag: (item: ImportItem) => {
      if (item.rating !== undefined)
        return interpolate(copy.preview.yourRating, {
          score: formatOwnRating(locale, item.rating),
        });
      return item.state === 'planned' ? copy.preview.want : undefined;
    },
  };
}

export function PreviewRows({ items }: { items: readonly ImportItem[] }) {
  const copy = useRowCopy();

  return (
    <ul className="grid grid-cols-1 rounded-[20px] bg-surface px-3.5 md:grid-cols-2 md:gap-x-8 md:rounded-3xl md:px-5 [&>li]:border-separator max-md:[&>li+li]:border-t md:[&>li:nth-child(n+3)]:border-t">
      {withOccurrenceKeys(items, itemKey).map(({ item, key }) => {
        const tag = copy.tag(item);
        const meta = copy.meta(item);
        return (
          <li key={key} className="flex min-h-14 items-center gap-3 py-2 md:min-h-15">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold">{copy.title(item)}</span>
              {meta ? <span className="text-[13px] text-muted tabular-nums">{meta}</span> : null}
            </span>
            {tag ? (
              <Chip
                size="sm"
                color={item.rating !== undefined ? 'accent' : 'default'}
                variant="soft"
                className="shrink-0 font-bold tabular-nums"
              >
                {tag}
              </Chip>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
