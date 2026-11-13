import type { ComponentType } from 'react';
import { Skeleton } from '@heroui/react';
import { TopRankTileSkeleton, TrendingCardSkeleton } from '@/entities/media';

const CARD_PLACEHOLDERS = 4;
const TILE_PLACEHOLDERS = 8;
const TOP_THREE_PLACEHOLDERS = 3;

interface RailSkeletonRowProps {
  count: number;
  Placeholder: ComponentType;
  itemClassName: string;
}

function RailSkeletonRow({ count, Placeholder, itemClassName }: RailSkeletonRowProps) {
  return (
    <div className="flex gap-3 overflow-hidden px-4 md:px-0">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`shrink-0 ${itemClassName}`}>
          <Placeholder />
        </div>
      ))}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex min-h-tap items-center px-4 md:px-0">
      <Skeleton className="h-5 w-40 rounded-full" />
    </div>
  );
}

export function HeroSkeleton() {
  return <Skeleton aria-hidden className="h-108 w-full rounded-none md:h-120 md:rounded-3xl" />;
}

export function CardRailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <HeaderSkeleton />
      <RailSkeletonRow
        count={CARD_PLACEHOLDERS}
        Placeholder={TrendingCardSkeleton}
        itemClassName="md:w-[calc((100%-1.5rem)/3)]"
      />
    </div>
  );
}

export function TileRailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <HeaderSkeleton />
      <RailSkeletonRow
        count={TILE_PLACEHOLDERS}
        Placeholder={TopRankTileSkeleton}
        itemClassName="md:w-[calc((100%-5.25rem)/8)]"
      />
    </div>
  );
}

export function TopThreeSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <HeaderSkeleton />
      <div className="grid gap-2 px-4 md:grid-cols-3 md:gap-3 md:px-0">
        {Array.from({ length: TOP_THREE_PLACEHOLDERS }, (_, index) => (
          <Skeleton key={index} className="h-30 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
