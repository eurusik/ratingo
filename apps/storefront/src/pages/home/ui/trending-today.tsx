'use client';

import { useRef } from 'react';
import {
  TopRankTile,
  TopRankTileSkeleton,
  TrendingCard,
  TrendingCardSkeleton,
} from '@/entities/media';
import { OwnScoreChip } from '@/entities/library';
import { SaveButton } from '@/features/save-to-library';
import { useTranslation } from '@/shared/i18n';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import { useTrendingToday } from '../model/trending';

const TRENDING_PLACEHOLDERS = 6;
const TOP_PLACEHOLDERS = 10;

function placeholderKeys(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function TrendingSkeleton({ label }: { label: string }) {
  return (
    <div aria-hidden>
      <Rail label={label}>
        {placeholderKeys(TRENDING_PLACEHOLDERS).map((key) => (
          <RailItem key={key}>
            <TrendingCardSkeleton />
          </RailItem>
        ))}
      </Rail>
    </div>
  );
}

function TopSkeleton({ label }: { label: string }) {
  return (
    <div aria-hidden>
      <Rail label={label} isOrdered desktop="grid">
        {placeholderKeys(TOP_PLACEHOLDERS).map((key) => (
          <RailItem key={key}>
            <TopRankTileSkeleton />
          </RailItem>
        ))}
      </Rail>
    </div>
  );
}

export function TrendingToday() {
  const { dict } = useTranslation();
  const { data, isPending, isError } = useTrendingToday();
  const trendingScroller = useRef<HTMLDivElement>(null);
  const hasFailed = isError && !data;

  return (
    <div className="flex flex-col gap-6 py-3" aria-busy={isPending}>
      {isPending ? (
        <p role="status" className="sr-only">
          {dict.common.loading}
        </p>
      ) : null}
      <section aria-labelledby="trending-now" className="flex flex-col gap-2">
        <SectionHeader
          id="trending-now"
          title={dict.home.trending}
          trailing={data ? <RailPager scrollerRef={trendingScroller} /> : null}
        />
        {isPending ? <TrendingSkeleton label={dict.home.trending} /> : null}
        {hasFailed ? <p className="px-4 text-sm text-muted">{dict.home.trendingFailed}</p> : null}
        {data ? (
          <Rail label={dict.home.trending} scrollerRef={trendingScroller}>
            {data.trending.map((media) => (
              <RailItem key={media.mediaItemId}>
                <TrendingCard
                  media={media}
                  actions={<SaveButton media={media} tone="overlay" />}
                  footer={<OwnScoreChip mediaItemId={media.mediaItemId} />}
                />
              </RailItem>
            ))}
          </Rail>
        ) : null}
      </section>
      {hasFailed || data?.top.length === 0 ? null : (
        <section aria-labelledby="top-today" className="flex flex-col gap-2">
          <SectionHeader id="top-today" title={dict.home.topToday} />
          {data ? (
            <Rail label={dict.home.topToday} isOrdered desktop="grid">
              {data.top.map((media, index) => (
                <RailItem key={media.mediaItemId}>
                  <TopRankTile media={media} rank={index + 1} />
                </RailItem>
              ))}
            </Rail>
          ) : (
            <TopSkeleton label={dict.home.topToday} />
          )}
        </section>
      )}
    </div>
  );
}
