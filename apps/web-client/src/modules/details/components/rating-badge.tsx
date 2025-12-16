/**
 * Individual rating badge component.
 * Displays a single rating source (IMDb, TMDB, Trakt, RT).
 */

interface RatingBadgeProps {
  source: 'IMDb' | 'TMDB' | 'Trakt' | 'RT';
  rating: number;
  isPercentage?: boolean;
}

const SOURCE_CONFIG = {
  IMDb: { color: 'yellow-400', bgColor: 'yellow-400/20' },
  TMDB: { color: 'blue-400', bgColor: 'blue-400/20' },
  Trakt: { color: 'red-400', bgColor: 'red-400/20' },
  RT: { color: 'green-400', bgColor: 'green-400/20' },
} as const;

export function RatingBadge({ source, rating, isPercentage = false }: RatingBadgeProps) {
  const config = SOURCE_CONFIG[source];
  const formattedRating = isPercentage ? `${rating}%` : rating.toFixed(1);

  return (
    <div className="flex items-center gap-1.5 bg-zinc-900/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
      <span className={`text-[10px] font-bold text-${config.color} bg-${config.bgColor} px-1 py-0.5 rounded`}>
        {source}
      </span>
      <span className="text-sm font-semibold text-zinc-300">{formattedRating}</span>
    </div>
  );
}
