'use client';

import { TrendingCard, type TrendingMedia } from '@/entities/media';
import { OwnScoreChip } from '@/entities/library';
import { SaveButton } from '@/features/save-to-library';
import { useTranslation } from '@/shared/i18n';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import { loadReleaseList } from '../api/home-rails';
import type { RailStart, ReleaseList } from '../model/home-feed';
import { CardRowSkeleton } from './home-skeletons';
import { RailFilterBar, useRailFilter } from './rail-filter';

const SECTION_ID = 'new-releases';

export function NewReleases({ rail }: { rail: RailStart<ReleaseList, TrendingMedia> }) {
  const { dict } = useTranslation();
  const filter = useRailFilter(SECTION_ID, rail, loadReleaseList);
  const title = dict.home.newReleases;

  if (!filter.active) return null;

  return (
    <section
      aria-labelledby={SECTION_ID}
      className="flex below-fold flex-col gap-2 [--fold-size:24rem] md:[--fold-size:30rem]"
    >
      <SectionHeader
        id={SECTION_ID}
        title={title}
        caption={dict.home.newReleasesCaption}
        trailing={<RailPager scrollerRef={filter.scrollerRef} />}
      />
      <RailFilterBar
        label={dict.home.releaseFilter.label}
        labels={dict.home.releaseFilter}
        available={filter.available}
        active={filter.active}
        onSelect={filter.select}
        onIntent={filter.prefetchOthers}
      />
      {filter.items ? (
        <Rail label={title} scrollerRef={filter.scrollerRef} memoryKey={filter.memoryKey}>
          {filter.items.map((media) => (
            <RailItem key={media.mediaItemId}>
              <TrendingCard
                media={media}
                actions={<SaveButton media={media} tone="overlay" />}
                footer={<OwnScoreChip mediaItemId={media.mediaItemId} />}
              />
            </RailItem>
          ))}
        </Rail>
      ) : (
        <CardRowSkeleton />
      )}
    </section>
  );
}
