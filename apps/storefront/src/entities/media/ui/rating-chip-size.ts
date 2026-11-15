export type RatingChipSize = 'sm' | 'md';

interface RatingChipClasses {
  row: string;
  chip: string;
  imdbChip: string;
  criticsChip: string;
  badge: string;
  icon: string;
}

export const RATING_CHIP_CLASSES: Record<RatingChipSize, RatingChipClasses> = {
  sm: {
    row: 'gap-1',
    chip: 'gap-1 bg-transparent px-0 text-[11px] text-foreground',
    imdbChip: '',
    criticsChip: '',
    badge: 'text-[10px]',
    icon: 'size-3.5',
  },
  md: {
    row: 'gap-1.5',
    chip: 'gap-1.5 poster-glass text-xs',
    imdbChip: 'ps-1',
    criticsChip: 'ps-2',
    badge: 'text-[11px]',
    icon: 'size-4',
  },
};
