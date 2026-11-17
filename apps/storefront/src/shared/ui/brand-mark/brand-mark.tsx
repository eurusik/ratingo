import { BRAND_NAME } from '@/shared/config';
import {
  BRAND_MARK_COLORS,
  BRAND_MARK_SHAPES,
  BRAND_MARK_VIEW_BOX,
  type BrandMarkShape,
} from './brand-mark-shapes';

interface BrandMarkProps {
  size?: number;
}

interface BrandIconProps extends BrandMarkProps {
  playing?: boolean;
}

function MarkShape({
  shape,
  color,
  className,
}: {
  shape: BrandMarkShape;
  color: string;
  className?: string;
}) {
  const { d, strokeWidth } = BRAND_MARK_SHAPES[shape];

  return (
    <path
      d={d}
      fill={color}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      className={className}
    />
  );
}

function markShapes(playing: boolean) {
  return (
    <>
      <MarkShape shape="leg" color={BRAND_MARK_COLORS.leg} />
      <MarkShape shape="body" color={BRAND_MARK_COLORS.body} />
      <MarkShape
        shape="cutout"
        color="currentColor"
        className={
          playing
            ? 'origin-center [transform-box:fill-box] motion-safe:animate-brand-play'
            : undefined
        }
      />
    </>
  );
}

const MARK_SHAPES = markShapes(false);
const PLAYING_MARK_SHAPES = markShapes(true);

export function BrandIcon({ size = 32, playing = false }: BrandIconProps) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[31%] bg-surface text-surface ring-1 ring-foreground/10 ring-inset"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={BRAND_MARK_VIEW_BOX} focusable="false">
        {playing ? PLAYING_MARK_SHAPES : MARK_SHAPES}
      </svg>
    </span>
  );
}

export function BrandMark({ size }: BrandMarkProps) {
  return (
    <>
      <BrandIcon size={size} />
      {BRAND_NAME}
    </>
  );
}
