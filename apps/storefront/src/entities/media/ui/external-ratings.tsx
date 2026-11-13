import { CriticsChip } from './critics-chip';
import { ImdbChip } from './imdb-chip';
import { RATING_CHIP_CLASSES, type RatingChipSize } from './rating-chip-size';

interface ExternalRatingsProps {
  imdbRating?: number;
  criticsPercent?: number;
  size?: RatingChipSize;
  className?: string;
}

export function ExternalRatings({
  imdbRating,
  criticsPercent,
  size = 'md',
  className,
}: ExternalRatingsProps) {
  if (imdbRating === undefined && criticsPercent === undefined) return null;

  return (
    <div className={`flex ${RATING_CHIP_CLASSES[size].row} ${className ?? ''}`}>
      {imdbRating === undefined ? null : <ImdbChip rating={imdbRating} size={size} />}
      {criticsPercent === undefined ? null : <CriticsChip percent={criticsPercent} size={size} />}
    </div>
  );
}
