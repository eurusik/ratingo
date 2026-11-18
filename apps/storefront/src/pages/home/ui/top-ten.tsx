'use client';

import { TopRankTile, type TrendingMedia } from '@/entities/media';
import type { MediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import { loadTrendingList } from '../api/home-rails';
import type { RailStart } from '../model/rail-start';
import { TileRowSkeleton } from './home-skeletons';
import { RailBody, RailFilterBar, useRailFilter } from './rail-filter';

const SECTION_ID = 'top-ten';

export function TopTen({ rail }: { rail: RailStart<MediaType, TrendingMedia> }) {
  const { dict } = useTranslation();
  const filter = useRailFilter(SECTION_ID, rail, loadTrendingList);
  const title = dict.home.topTen;

  if (!filter.active) return null;

  return (
    <section
      aria-labelledby={SECTION_ID}
      aria-busy={filter.isLoadingList}
      className="flex flex-col gap-2"
    >
      <SectionHeader
        id={SECTION_ID}
        title={title}
        caption={dict.home.topTenCaption}
        trailing={<RailPager key={filter.pagerKey} scrollerRef={filter.scrollerRef} />}
      />
      <RailFilterBar
        label={dict.home.typeFilter.label}
        labels={dict.home.typeFilter}
        available={filter.available}
        active={filter.active}
        onSelect={filter.select}
        onIntent={filter.prefetchOthers}
      />
      <RailBody
        filter={filter}
        failedTitle={dict.home.failed.topTen}
        skeleton={<TileRowSkeleton />}
      >
        {(items) => (
          <Rail
            label={title}
            isOrdered
            itemSize="tile"
            scrollerRef={filter.scrollerRef}
            memoryKey={filter.memoryKey}
          >
            {items.map((media, index) => (
              <RailItem key={media.mediaItemId}>
                <TopRankTile media={media} rank={index + 1} />
              </RailItem>
            ))}
          </Rail>
        )}
      </RailBody>
    </section>
  );
}
