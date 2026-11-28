import type { ReactNode } from 'react';
import { cn } from '@ratingo/web-core/lib';
import { ReturningImage } from '../returning-image/returning-image';

const STILL_SIZES = {
  row: { width: 112, height: 63, className: 'h-[63px] w-28' },
  card: { width: 88, height: 52, className: 'h-13 w-22' },
  hero: { width: 780, height: 439, className: 'aspect-video w-full rounded-[14px]' },
} as const;

export type StillSize = keyof typeof STILL_SIZES;

export function stillShape(size: StillSize): string {
  return cn('shrink-0 rounded-[10px]', STILL_SIZES[size].className);
}

interface StillFrameProps {
  src?: string;
  size: StillSize;
  isPoster?: boolean;
  isDimmed?: boolean;
  isPriority?: boolean;
  placeholder?: ReactNode;
  children?: ReactNode;
}

export function StillFrame({
  src,
  size,
  isPoster = false,
  isDimmed = false,
  isPriority = false,
  placeholder,
  children,
}: StillFrameProps) {
  const { width, height } = STILL_SIZES[size];

  return (
    <span aria-hidden className={cn('relative overflow-hidden bg-default', stillShape(size))}>
      {src ? (
        <ReturningImage
          unoptimized
          src={src}
          alt=""
          width={width}
          height={height}
          loading={isPriority ? 'eager' : 'lazy'}
          fetchPriority={isPriority ? 'high' : undefined}
          className={cn('size-full object-cover', isPoster && 'object-[center_20%]')}
        />
      ) : (
        placeholder
      )}
      {isDimmed ? <span className="absolute inset-0 bg-background/45" /> : null}
      {children}
    </span>
  );
}
