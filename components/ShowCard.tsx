import Link from 'next/link';
import Image from 'next/image';
import { Show } from '@/db/schema';

interface ShowCardProps {
  show: Show & { posterUrl: string | null };
  rank?: number;
  region?: string | null;
}

export function ShowCard({ show, rank, region = null }: ShowCardProps) {
  const href = region ? `/show/${show.id}?region=${region}` : `/show/${show.id}`;
  return (
    <Link href={href}>
      <div className="group relative bg-zinc-900/50 backdrop-blur rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20 hover:ring-2 hover:ring-blue-500/50 h-full flex flex-col">
        {/* Poster */}
        <div className="aspect-[2/3] relative bg-zinc-800 overflow-hidden">
          {show.posterUrl ? (
            <>
              <Image
                src={show.posterUrl}
                alt={show.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 768px) 50vw, 20vw"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <div className="text-center">
                <div className="text-4xl mb-2">📺</div>
                <div className="text-sm">Без постера</div>
              </div>
            </div>
          )}

          {/* Rank & Trending Badges */}
          {rank && rank <= 3 && (
            <div className="absolute top-2 left-2 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full">
              №{rank}
            </div>
          )}
          {show.trendingScore && show.trendingScore > 80 && (
            <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
              🔥 ХІТ
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex-1 flex flex-col">
          <h3 className="font-semibold text-white line-clamp-2 mb-2 text-sm group-hover:text-blue-400 transition-colors min-h-[2.5rem]">
            {show.titleUk || show.title}
          </h3>

          {/* Ratings */}
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <span className="text-yellow-400">⭐</span>
                <span className="text-white font-semibold">
                  {(show as any).primaryRating?.toFixed(1) ||
                    show.ratingTmdb?.toFixed(1) ||
                    (show as any).ratingTraktAvg?.toFixed(1) ||
                    show.ratingImdb?.toFixed(1) ||
                    'N/A'}
                </span>
              </div>
              {show.ratingImdb !== null && show.ratingImdb !== undefined && (
                <div className="flex items-center space-x-1">
                  <span className="text-yellow-300">IMDb</span>
                  <span className="text-white font-semibold">{show.ratingImdb?.toFixed(1)}</span>
                </div>
              )}
            </div>
            {show.ratingTrakt !== null && show.ratingTrakt !== undefined && (
              <div className="flex items-center space-x-1">
                <span className="text-blue-400">👁</span>
                <span className="text-gray-300">
                  {show.ratingTrakt > 1000
                    ? `${(show.ratingTrakt / 1000).toFixed(1)}K`
                    : show.ratingTrakt}
                </span>
              </div>
            )}
          </div>

          {/* Spacer to push bottom content down */}
          <div className="flex-1" />

          {/* Episodes Compact */}
          {(show as any).nextEpisodeNumber !== null &&
          (show as any).nextEpisodeNumber !== undefined ? (
            <div className="mb-2 text-xs text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-zinc-800 rounded">
                  S{(show as any).nextEpisodeSeason}E{(show as any).nextEpisodeNumber}
                </span>
                {(show as any).nextEpisodeAirDate && (
                  <span className="text-gray-300">
                    {new Date((show as any).nextEpisodeAirDate).toLocaleDateString('uk-UA')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-2 h-5" />
          )}

          {/* Season Progress */}
          {typeof (show as any).latestSeasonEpisodes === 'number' &&
          typeof (show as any).lastEpisodeNumber === 'number' ? (
            <div className="mb-2">
              <div className="h-1.5 bg-zinc-800 rounded">
                <div
                  className="h-1.5 bg-blue-500 rounded"
                  style={{
                    width: `${Math.max(0, Math.min(100, Math.round(((show as any).lastEpisodeNumber / (show as any).latestSeasonEpisodes) * 100)))}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="mb-2 h-1.5" />
          )}
        </div>
      </div>
    </Link>
  );
}
