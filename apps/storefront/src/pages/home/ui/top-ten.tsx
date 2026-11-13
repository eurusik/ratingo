'use client';

import { useRef } from 'react';
import { TopRankTile, type TrendingMedia } from '@/entities/media';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';

interface TopTenProps {
  type: MediaType;
  items: TrendingMedia[];
}

export function TopTen({ type, items }: TopTenProps) {
  const { dict } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const id = `top-${type}s`;
  const title = type === 'show' ? dict.home.topShows : dict.home.topMovies;

  if (items.length === 0) return null;

  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <SectionHeader id={id} title={title} trailing={<RailPager scrollerRef={scroller} />} />
      <Rail label={title} isOrdered itemSize="tile" scrollerRef={scroller}>
        {items.map((media, index) => (
          <RailItem key={media.mediaItemId}>
            <TopRankTile media={media} rank={index + 1} />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
