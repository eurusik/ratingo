import { Star, Eye } from 'lucide-react';

interface CardRatingProps {
  rating?: number | null;
  ratingImdb?: number | null;
  watchers?: number | null;
  className?: string;
}

export function CardRating({ rating, ratingImdb, watchers, className = '' }: CardRatingProps) {
  return (
    <div className={`flex items-center justify-between text-xs ${className}`}>
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-semibold">{rating?.toFixed(1) || 'N/A'}</span>
        </div>
        {ratingImdb != null && (
          <div className="flex items-center space-x-1">
            <span className="text-yellow-300">IMDb</span>
            <span className="text-white font-semibold">{ratingImdb.toFixed(1)}</span>
          </div>
        )}
      </div>
      {watchers != null && (
        <div className="flex items-center space-x-1">
          <Eye className="w-3 h-3 text-blue-400" />
          <span className="text-gray-300">
            {watchers > 1000 ? `${(watchers / 1000).toFixed(1)}K` : watchers}
          </span>
        </div>
      )}
    </div>
  );
}
