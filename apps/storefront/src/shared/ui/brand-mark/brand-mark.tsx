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

function MarkShape({ shape, color }: { shape: BrandMarkShape; color: string }) {
  const { d, strokeWidth } = BRAND_MARK_SHAPES[shape];

  return (
    <path d={d} fill={color} stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
  );
}

const MARK_SHAPES = (
  <>
    <MarkShape shape="leg" color={BRAND_MARK_COLORS.leg} />
    <MarkShape shape="body" color={BRAND_MARK_COLORS.body} />
    <MarkShape shape="cutout" color="currentColor" />
  </>
);

export function BrandMark({ size = 32 }: BrandMarkProps) {
  return (
    <>
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-[31%] bg-surface text-surface ring-1 ring-foreground/10 ring-inset"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={BRAND_MARK_VIEW_BOX} focusable="false">
          {MARK_SHAPES}
        </svg>
      </span>
      {BRAND_NAME}
    </>
  );
}
