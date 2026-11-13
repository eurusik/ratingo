import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { RATING_CHIP_CLASSES, type RatingChipSize } from './rating-chip-size';

function TomatoIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={`shrink-0 ${className}`}>
      <circle cx="8" cy="9.2" r="6" fill="#e5402b" />
      <path
        fill="#3e9c35"
        d="M8 3.6c-.9-1.2-2.4-1.6-3.4-1 1 .1 1.9.7 2.4 1.5-1-.3-2.2 0-2.9.7 1.2-.2 2.4.1 3.2.8.3-.6.5-1.3.7-2z"
      />
      <path
        fill="#4cb044"
        d="M8 3.6c.9-1.2 2.4-1.6 3.4-1-1 .1-1.9.7-2.4 1.5 1-.3 2.2 0 2.9.7-1.2-.2-2.4.1-3.2.8-.3-.6-.5-1.3-.7-2z"
      />
    </svg>
  );
}

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
      className={`font-extrabold tabular-nums ${size === 'md' ? 'ps-2' : ''} ${RATING_CHIP_CLASSES[size].chip}`}
    >
      <TomatoIcon className={RATING_CHIP_CLASSES[size].icon} />
      <span aria-hidden>{`${rounded}%`}</span>
      <span className="sr-only">{interpolate(dict.media.criticsLabel, { percent: rounded })}</span>
    </Chip>
  );
}
