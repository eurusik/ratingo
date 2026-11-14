'use client';

import { TopRankTile, type TrendingMedia } from '@/entities/media';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import { RailFilterBar, useRailFilter } from './rail-filter';

const SECTION_ID = 'top-ten';
const TYPES: readonly [MediaType, ...MediaType[]] = ['show', 'movie'];

interface TopTenProps {
  shows: TrendingMedia[];
  movies: TrendingMedia[];
}

export function TopTen({ shows, movies }: TopTenProps) {
  const { dict } = useTranslation();
  const filter = useRailFilter(SECTION_ID, { show: shows, movie: movies }, TYPES);
  const title = dict.home.topTen;

  if (!filter.active) return null;

  return (
    <section aria-labelledby={SECTION_ID} className="flex flex-col gap-2">
      <SectionHeader
        id={SECTION_ID}
        title={title}
        caption={dict.home.topTenCaption}
        trailing={<RailPager scrollerRef={filter.scrollerRef} />}
      />
      <RailFilterBar
        label={dict.home.typeFilter.label}
        labels={dict.home.typeFilter}
        available={filter.available}
        active={filter.active}
        onSelect={filter.select}
      />
      <Rail
        label={title}
        isOrdered
        itemSize="tile"
        scrollerRef={filter.scrollerRef}
        memoryKey={filter.memoryKey}
      >
        {filter.items.map((media, index) => (
          <RailItem key={media.mediaItemId}>
            <TopRankTile media={media} rank={index + 1} />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
