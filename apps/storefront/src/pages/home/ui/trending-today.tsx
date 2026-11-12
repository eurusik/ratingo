'use client';

import { useRef, type ComponentType } from 'react';
import { Button } from '@heroui/react';
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
const PRIORITY_CARDS = 2;

interface RailSkeletonProps {
  label: string;
  count: number;
  Placeholder: ComponentType;
  isOrdered?: boolean;
  desktop?: 'peek' | 'grid';
}

function RailSkeleton({ label, count, Placeholder, isOrdered, desktop }: RailSkeletonProps) {
  return (
    <div aria-hidden>
      <Rail label={label} isOrdered={isOrdered} desktop={desktop}>
        {Array.from({ length: count }, (_, index) => (
          <RailItem key={index}>
            <Placeholder />
          </RailItem>
        ))}
      </Rail>
    </div>
  );
}

export function TrendingToday() {
  const { dict } = useTranslation();
  const { data, isPending, isError, refetch } = useTrendingToday();
  const trendingScroller = useRef<HTMLDivElement>(null);
  const hasFailed = isError && !data;
  const hasTrending = isPending || (data?.trending.length ?? 0) > 0;
  const hasTop = isPending || (data?.top.length ?? 0) > 0;

  if (hasFailed) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 px-4 py-6 md:px-0">
        <p className="text-sm text-muted">{dict.home.trendingFailed}</p>
        <Button size="sm" variant="secondary" onPress={() => void refetch()}>
          {dict.common.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-3" aria-busy={isPending}>
      {isPending ? (
        <p role="status" className="sr-only">
          {dict.common.loading}
        </p>
      ) : null}
      {hasTrending ? (
        <section aria-labelledby="trending-now" className="flex flex-col gap-2">
          <SectionHeader
            id="trending-now"
            title={dict.home.trending}
            trailing={data ? <RailPager scrollerRef={trendingScroller} /> : null}
          />
          {data ? (
            <Rail label={dict.home.trending} scrollerRef={trendingScroller}>
              {data.trending.map((media, index) => (
                <RailItem key={media.mediaItemId}>
                  <TrendingCard
                    media={media}
                    isPriority={index < PRIORITY_CARDS}
                    actions={<SaveButton media={media} tone="overlay" />}
                    footer={<OwnScoreChip mediaItemId={media.mediaItemId} />}
                  />
                </RailItem>
              ))}
            </Rail>
          ) : (
            <RailSkeleton
              label={dict.home.trending}
              count={TRENDING_PLACEHOLDERS}
              Placeholder={TrendingCardSkeleton}
            />
          )}
        </section>
      ) : null}
      {hasTop ? (
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
            <RailSkeleton
              label={dict.home.topToday}
              count={TOP_PLACEHOLDERS}
              Placeholder={TopRankTileSkeleton}
              isOrdered
              desktop="grid"
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
