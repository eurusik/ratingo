import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { RATING_CHIP_CLASSES, type RatingChipSize } from './rating-chip-size';
import { TomatoIcon } from './rating-source-logo';

interface CriticsChipProps {
  percent: number;
  size?: RatingChipSize;
}

export function CriticsChip({ percent, size = 'md' }: CriticsChipProps) {
  const { dict } = useTranslation();
  const rounded = Math.round(percent);

  return (
    <Chip
      size={size}
      className={`font-extrabold tabular-nums ${RATING_CHIP_CLASSES[size].chip} ${RATING_CHIP_CLASSES[size].criticsChip}`}
    >
      <TomatoIcon className={RATING_CHIP_CLASSES[size].icon} />
      <span aria-hidden>{`${rounded}%`}</span>
      <span className="sr-only">{interpolate(dict.media.criticsLabel, { percent: rounded })}</span>
    </Chip>
  );
}
