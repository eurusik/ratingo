import type { ComponentType } from 'react';
import { Skeleton } from '@heroui/react';
import { TopRankTileSkeleton, TrendingCardSkeleton } from '@/entities/media';
import { HERO_FRAME_CLASS } from './hero-frame';
import { RankCorner } from './rank-corner';

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

function TextLineSkeleton({
  lineClassName,
  barClassName,
}: {
  lineClassName: string;
  barClassName: string;
}) {
  return (
    <div className={`flex items-center ${lineClassName}`}>
      <Skeleton className={`rounded-full ${barClassName}`} />
    </div>
  );
}

const HERO_CHIP_WIDTHS = ['w-14', 'w-19', 'w-17', 'w-12'];
const HERO_OVERVIEW_LINES = [
  { id: 'first', width: 'w-full' },
  { id: 'second', width: 'w-full' },
  { id: 'last', width: 'w-2/3' },
];

export function HeroSkeleton() {
  return (
    <div aria-hidden className={HERO_FRAME_CLASS}>
      <Skeleton className="absolute inset-0 -z-10 rounded-none" />
      <span className="hero-fade md:hero-fade-side absolute inset-0 -z-10" />
      <RankCorner />
      <span className="absolute end-4 top-4 size-11 rounded-full bg-background/60 md:end-8 md:top-8" />
      <div className="flex flex-col gap-2.5 px-4 pt-24 pb-5 md:max-w-xl md:px-8 md:pb-8">
        <TextLineSkeleton
          lineClassName="h-9.5 md:h-15"
          barClassName="h-8 w-4/5 rounded-lg md:h-12"
        />
        <TextLineSkeleton lineClassName="h-5" barClassName="h-3.5 w-48" />
        <div className="flex h-6 items-center gap-1.5">
          {HERO_CHIP_WIDTHS.map((width) => (
            <Skeleton key={width} className={`h-6 rounded-full ${width}`} />
          ))}
        </div>
        <div className="flex flex-col">
          {HERO_OVERVIEW_LINES.map((line) => (
            <TextLineSkeleton
              key={line.id}
              lineClassName="h-5 md:h-6"
              barClassName={`h-3.5 md:h-4 ${line.width}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
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
