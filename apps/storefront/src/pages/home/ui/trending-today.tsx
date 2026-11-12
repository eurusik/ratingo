'use client';

import { Skeleton } from '@heroui/react';
import { TopRankTile, TrendingCard } from '@/entities/media';
import { OwnScoreChip } from '@/entities/library';
import { SaveButton } from '@/features/save-to-library';
import { useTranslation } from '@/shared/i18n';
import { Rail, RailItem, SectionHeader } from '@/shared/ui';
import { useTrendingToday } from '../model/trending';

const PLACEHOLDER_CARDS = ['first', 'second'];

function TrendingSkeleton() {
  return (
    <div aria-hidden className="flex gap-3 overflow-hidden px-4">
      {PLACEHOLDER_CARDS.map((key) => (
        <Skeleton key={key} className="h-80 w-77.5 shrink-0 rounded-3xl" />
      ))}
    </div>
  );
}

export function TrendingToday() {
  const { dict } = useTranslation();
  const { data, isPending, isError } = useTrendingToday();

  return (
    <div className="flex flex-col gap-6 py-3">
      <section aria-labelledby="trending-now" className="flex flex-col gap-2">
        <SectionHeader id="trending-now" title={dict.home.trending} />
        {isPending ? <TrendingSkeleton /> : null}
        {isError ? <p className="px-4 text-sm text-muted">{dict.home.trendingFailed}</p> : null}
        {data ? (
          <Rail label={dict.home.trending}>
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
      {data && data.top.length > 0 ? (
        <section aria-labelledby="top-today" className="flex flex-col gap-2">
          <SectionHeader id="top-today" title={dict.home.topToday} />
          <Rail label={dict.home.topToday} isOrdered>
            {data.top.map((media, index) => (
              <RailItem key={media.mediaItemId}>
                <TopRankTile media={media} rank={index + 1} />
              </RailItem>
            ))}
          </Rail>
        </section>
      ) : null}
    </div>
  );
}
