import { CriticsChip } from './critics-chip';
import { ImdbChip } from './imdb-chip';

interface ExternalRatingsProps {
  imdbRating?: number;
  criticsPercent?: number;
  className?: string;
}

export function ExternalRatings({ imdbRating, criticsPercent, className }: ExternalRatingsProps) {
  if (imdbRating === undefined && criticsPercent === undefined) return null;

  return (
    <div className={`flex gap-1.5 ${className ?? ''}`}>
      {imdbRating === undefined ? null : <ImdbChip rating={imdbRating} />}
      {criticsPercent === undefined ? null : <CriticsChip percent={criticsPercent} />}
    </div>
  );
}
