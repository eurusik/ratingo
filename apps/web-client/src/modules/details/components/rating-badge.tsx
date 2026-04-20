/**
 * Individual rating badge component.
 * Displays a single rating source (IMDb, TMDB, Trakt, RT).
 */

interface RatingBadgeProps {
  source: 'IMDb' | 'TMDB' | 'Trakt' | 'RT' | 'RT Audience';
  rating: number;
  isPercentage?: boolean;
}

// Full literal Tailwind class strings — required so the Tailwind JIT scanner
// actually emits these classes. Dynamic construction like `text-${variable}`
// is invisible to the scanner and produces bundles missing the colours.
//
// RT (Tomatometer) stays green — matches Ratingo's existing critics-centric display.
// RT Audience (Popcornmeter) gets orange — visually distinct and aligned with the
// popcorn colour used on rottentomatoes.com for audience scores.
const SOURCE_CONFIG = {
  IMDb: { text: 'text-yellow-400', bg: 'bg-yellow-400/20' },
  TMDB: { text: 'text-blue-400', bg: 'bg-blue-400/20' },
  Trakt: { text: 'text-red-400', bg: 'bg-red-400/20' },
  RT: { text: 'text-green-400', bg: 'bg-green-400/20' },
  'RT Audience': { text: 'text-orange-400', bg: 'bg-orange-400/20' },
} as const;

export function RatingBadge({ source, rating, isPercentage = false }: RatingBadgeProps) {
  const config = SOURCE_CONFIG[source];
  const formattedRating = isPercentage ? `${rating}%` : rating.toFixed(1);

  return (
    <div className="flex items-center gap-1.5 bg-cinema-card/60 backdrop-blur-sm px-2.5 py-1 rounded-lg">
      <span
        className={`text-[10px] font-bold ${config.text} ${config.bg} px-1 py-0.5 rounded`}
      >
        {source}
      </span>
      <span className="text-sm font-semibold text-cinema-text-secondary">{formattedRating}</span>
    </div>
  );
}
