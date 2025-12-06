'use client';

import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import CastList from '@/components/CastList';
import { WatchProviders } from '@/components/WatchProviders';
import { Star, Calendar, Clock } from 'lucide-react';

export function ClientMovieDetail({ movie }: { movie: any }) {
  const searchParams = useSearchParams();
  const regionParam = searchParams.get('region');

  const trailer = movie.videos?.find((v: any) => v.type === 'Trailer') || movie.videos?.[0];
  const releaseYear = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero Section with Backdrop */}
      <div className="relative h-96 md:h-[500px] overflow-hidden">
        {movie.backdropUrl ? (
          <div className="relative w-full h-full">
            <Image
              src={movie.backdropUrl}
              alt={movie.title}
              fill
              className="object-cover blur-sm scale-110"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-zinc-900 to-zinc-950" />
        )}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
              {movie.titleUk || movie.title}
              {releaseYear && (
                <span className="text-gray-400 ml-4 text-3xl md:text-5xl">({releaseYear})</span>
              )}
            </h1>
            {movie.tagline && <p className="text-xl text-gray-300 italic">{movie.tagline}</p>}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {trailer && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Трейлер</h2>
                <div className="aspect-video bg-zinc-900 rounded-lg overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${trailer.key}`}
                    title={trailer.name}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold text-white mb-4">Опис</h2>
              <p className="text-gray-300 text-lg leading-relaxed break-words">
                {movie.overviewUk || movie.overview || 'Опис поки що недоступний.'}
              </p>
            </div>

            {/* Cast */}
            {movie.cast && movie.cast.length > 0 && <CastList cast={movie.cast} />}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {movie.posterUrl && (
              <div className="aspect-[2/3] relative bg-zinc-900 rounded-lg overflow-hidden">
                <Image src={movie.posterUrl} alt={movie.title} fill className="object-cover" />
              </div>
            )}

            {/* Movie Info */}
            <div className="bg-zinc-900 rounded-lg p-6 space-y-4">
              <h3 className="text-xl font-bold text-white mb-4">Інформація</h3>

              {movie.releaseDate && (
                <div className="flex items-center gap-3 text-gray-300">
                  <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
                  <div>
                    <div className="text-xs text-gray-500">Прем'єра</div>
                    <div className="font-semibold">
                      {new Date(movie.releaseDate).toLocaleDateString('uk-UA')}
                    </div>
                  </div>
                </div>
              )}

              {movie.runtime && (
                <div className="flex items-center gap-3 text-gray-300">
                  <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                  <div>
                    <div className="text-xs text-gray-500">Тривалість</div>
                    <div className="font-semibold">{movie.runtime} хв</div>
                  </div>
                </div>
              )}

              {movie.status && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Статус</span>
                  <span className="text-white font-semibold">{movie.status}</span>
                </div>
              )}
            </div>

            {/* Ratings */}
            <div className="bg-zinc-900 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">Рейтинги</h3>
              <div className="space-y-4">
                {movie.ratingTmdb != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">TMDB</span>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-white font-semibold text-lg">
                        {movie.ratingTmdb.toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                )}

                {movie.ratingImdb != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">IMDb</span>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="text-white font-semibold text-lg">
                        {movie.ratingImdb.toFixed(1)}/10
                      </span>
                    </div>
                  </div>
                )}

                {movie.ratingTrakt != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Trakt Watchers</span>
                    <span className="text-white font-semibold text-lg">
                      {movie.ratingTrakt.toLocaleString()}
                    </span>
                  </div>
                )}

                {movie.ratingMetacritic != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Metacritic</span>
                    <span className="text-white font-semibold text-lg">
                      {movie.ratingMetacritic}/100
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Watch Providers */}
            {movie.providers && movie.providers.length > 0 && (
              <WatchProviders
                providers={movie.providers}
                showTitle={movie.titleUk || movie.title}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
