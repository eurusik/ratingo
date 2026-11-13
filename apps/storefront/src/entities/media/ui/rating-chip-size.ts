export type RatingChipSize = 'sm' | 'md';

interface RatingChipClasses {
  chip: string;
  badge: string;
  icon: string;
}

export const RATING_CHIP_CLASSES: Record<RatingChipSize, RatingChipClasses> = {
  sm: {
    chip: 'gap-1 bg-transparent px-0 text-[11px] text-foreground',
    badge: 'text-[10px]',
    icon: 'size-3.5',
  },
  md: { chip: 'gap-1.5 bg-black/80 text-xs text-white', badge: 'text-[11px]', icon: 'size-4' },
};
