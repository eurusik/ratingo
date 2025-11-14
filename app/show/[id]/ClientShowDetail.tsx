'use client';

import { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import CastList from '@/components/CastList';
import { WatchProviders } from '@/components/WatchProviders';
import { generateShowJsonLd, generateBreadcrumbJsonLd } from '@/lib/seo/jsonld';

export function ClientShowDetail({ show }: { show: any }) {
  const router = useRouter();
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const regionParam = searchParams.get('region');

  const trailer = show.videos?.find((v: any) => v.type === 'Trailer') || show.videos?.[0];
  const showJsonLd = generateShowJsonLd(show);
  const breadcrumbJsonLd = generateBreadcrumbJsonLd([
    { name: 'Головна', url: '/' },
    { name: 'Тренди', url: '/trending' },
    { name: show.titleUk || show.title, url: `/show/${show.id}` },
  ]);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(showJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="min-h-screen bg-zinc-950">
        {/* Hero Section with Backdrop */}
        <div className="relative h-96 md:h-[500px]">
          {show.backdropUrl ? (
            <div className="relative w-full h-full">
              <Image
                src={show.backdropUrl}
                alt={show.title}
                fill
                className="object-cover"
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
                {show.titleUk || show.title}
              </h1>
              {show.tagline && <p className="text-xl text-gray-300 italic">{show.tagline}</p>}
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
                <p className="text-gray-300 text-lg leading-relaxed">
                  {show.overviewUk || show.overview || 'No overview available.'}
                </p>
              </div>

              {show.genres && show.genres.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Жанри</h2>
                  <div className="flex flex-wrap gap-2">
                    {show.genres.map((genre: any) => (
                      <span
                        key={genre.id}
                        className="px-4 py-2 bg-zinc-800 text-gray-300 rounded-full text-sm"
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Related */}
              {Array.isArray(show.related) && show.related.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white">Схожі</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (sliderRef.current)
                            sliderRef.current.scrollBy({ left: -1000, behavior: 'smooth' });
                        }}
                        className="px-3 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => {
                          if (sliderRef.current)
                            sliderRef.current.scrollBy({ left: 1000, behavior: 'smooth' });
                        }}
                        className="px-3 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <div ref={sliderRef} className="flex overflow-x-auto gap-4 snap-x snap-mandatory">
                    {show.related.map((r: any) => (
                      <a
                        key={r.id}
                        href={`/show/${r.id}${regionParam ? `?region=${regionParam}` : ''}`}
                        className="bg-zinc-900 rounded-lg overflow-hidden hover:bg-zinc-800 transition snap-start shrink-0 w-40 md:w-44 lg:w-48"
                      >
                        {r.posterUrl && (
                          <div className="relative aspect-[2/3]">
                            <Image src={r.posterUrl} alt={r.title} fill className="object-cover" />
                          </div>
                        )}
                        <div className="p-3">
                          <div className="text-white text-sm font-semibold truncate">{r.title}</div>
                          {r.primaryRating != null && (
                            <div className="text-xs text-gray-300 mt-1 flex items-center space-x-1">
                              <span>⭐</span>
                              <span>{Number(r.primaryRating).toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Cast */}
              <CastList cast={show.cast || []} />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {show.posterUrl && (
                <div className="aspect-[2/3] relative bg-zinc-900 rounded-lg overflow-hidden">
                  <Image src={show.posterUrl} alt={show.title} fill className="object-cover" />
                </div>
              )}

              {/* Ratings */}
              <div className="bg-zinc-900 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">Рейтинги</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">TMDB (з 10)</span>
                    <div className="flex items-center">
                      <span className="text-yellow-400 mr-2">⭐</span>
                      <span className="text-white font-semibold text-lg">
                        {show.ratingTmdb?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                  </div>
                  {show.ratingTmdbCount !== null && show.ratingTmdbCount !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Голоси TMDB</span>
                      <span className="text-white font-semibold text-lg">
                        {show.ratingTmdbCount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {show.popularityTmdb !== null && show.popularityTmdb !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Популярність TMDB</span>
                      <span className="text-white font-semibold text-lg">
                        {show.popularityTmdb.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {show.ratingImdb !== null && show.ratingImdb !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">IMDb (з 10)</span>
                      <div className="flex items-center">
                        <span className="text-yellow-300 mr-2">IMDb</span>
                        <span className="text-white font-semibold text-lg">
                          {show.ratingImdb.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )}
                  {show.imdbVotes !== null && show.imdbVotes !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Голоси IMDb</span>
                      <div className="flex items-center">
                        <span className="text-white font-semibold text-lg">
                          {show.imdbVotes.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  {show.ratingTraktAvg !== null && show.ratingTraktAvg !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Trakt (з 10)</span>
                      <div className="flex items-center">
                        <span className="text-pink-400 mr-2">TR</span>
                        <span className="text-white font-semibold text-lg">
                          {show.ratingTraktAvg.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  )}
                  {show.ratingTraktVotes !== null && show.ratingTraktVotes !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Голоси Trakt</span>
                      <div className="flex items-center">
                        <span className="text-white font-semibold text-lg">
                          {show.ratingTraktVotes.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                  {(() => {
                    const dist = show.ratings?.traktDistribution || [];
                    const votesVal = show.ratings?.trakt?.votes ?? null;
                    const distTotal = Array.isArray(dist)
                      ? dist.reduce((sum: number, d: any) => sum + (Number(d?.count) || 0), 0)
                      : 0;
                    const max = Array.isArray(dist)
                      ? dist.reduce((m: number, d: any) => Math.max(m, Number(d?.count) || 0), 0) ||
                        1
                      : 1;
                    if (!Array.isArray(dist) || dist.length === 0 || distTotal === 0) return null;
                    return (
                      <div className="mt-4">
                        <div className="mb-2">
                          <div className="text-gray-400">Розподіл оцінок Trakt</div>
                          <div className="text-gray-500 text-xs">
                            {(votesVal ?? distTotal).toLocaleString()} голосів
                          </div>
                        </div>
                        <div className="flex items-end gap-1 h-24 mt-2">
                          {Array.from({ length: 10 }, (_, i) => {
                            const bucket = i + 1;
                            const entry = dist.find((d: any) => Number(d?.bucket) === bucket);
                            const count = entry ? Number(entry.count) || 0 : 0;
                            const height = Math.max(4, Math.round((count / max) * 96));
                            const percent =
                              distTotal > 0 ? Math.round((count / distTotal) * 100) : 0;
                            const tooltip = `Оцінка ${bucket}: ${percent}% • ${count.toLocaleString()} голосів • Trakt — середня оцінка користувачів`;
                            return (
                              <div
                                key={bucket}
                                className="flex flex-col items-center"
                                title={tooltip}
                              >
                                <div className="w-4 bg-blue-600 rounded-t" style={{ height }} />
                                <span className="text-xs text-gray-400 mt-1">{bucket}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  {show.trendingScore !== null && show.trendingScore !== undefined && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">Індекс трендів</span>
                        <span className="text-white font-semibold text-lg">
                          {show.trendingScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="bg-zinc-800 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-full"
                          style={{ width: `${show.trendingScore}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Where to Watch */}
              <div className="bg-zinc-900 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  Де дивитись{regionParam ? ` (${regionParam})` : ''}
                </h3>
                <WatchProviders
                  providers={show.watchProviders || []}
                  showTitle={show.title}
                  imdbId={show.imdbId}
                  region={regionParam || null}
                />
              </div>

              {/* Епізоди */}
              <div className="bg-zinc-900 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">Епізоди</h3>
                <div className="space-y-4 text-sm">
                  {show.lastEpisodeNumber !== null && show.lastEpisodeNumber !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Остання серія</span>
                      <span className="text-white">
                        <span className="px-2 py-1 bg-zinc-800 rounded mr-2">
                          S{show.lastEpisodeSeason}E{show.lastEpisodeNumber}
                        </span>
                        {show.lastEpisodeAirDate
                          ? new Date(show.lastEpisodeAirDate).toLocaleDateString('uk-UA')
                          : ''}
                      </span>
                    </div>
                  )}
                  {show.nextEpisodeNumber !== null && show.nextEpisodeNumber !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Наступна серія</span>
                      <span className="text-white">
                        <span className="px-2 py-1 bg-zinc-800 rounded mr-2">
                          S{show.nextEpisodeSeason}E{show.nextEpisodeNumber}
                        </span>
                        {show.nextEpisodeAirDate
                          ? new Date(show.nextEpisodeAirDate).toLocaleDateString('uk-UA')
                          : ''}
                      </span>
                    </div>
                  )}
                  {show.latestSeasonEpisodes !== null &&
                    show.latestSeasonEpisodes !== undefined &&
                    show.lastEpisodeNumber !== null &&
                    show.lastEpisodeNumber !== undefined && (
                      <div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Прогрес сезону</span>
                          <span className="text-white">
                            {show.lastEpisodeNumber} / {show.latestSeasonEpisodes}{' '}
                            {typeof show.lastEpisodeNumber === 'number' &&
                            typeof show.latestSeasonEpisodes === 'number'
                              ? `(Залишилось ${show.latestSeasonEpisodes - show.lastEpisodeNumber})`
                              : ''}
                          </span>
                        </div>
                        <div className="mt-2 h-2 bg-zinc-800 rounded">
                          <div
                            className="h-2 bg-blue-500 rounded"
                            style={{
                              width: `${Math.max(0, Math.min(100, Math.round((show.lastEpisodeNumber / show.latestSeasonEpisodes) * 100)))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                </div>
              </div>

              {/* Show Info */}
              <div className="bg-zinc-900 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">Інформація про серіал</h3>
                <div className="space-y-3 text-sm">
                  {show.status && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Статус</span>
                      <span className="text-white">{show.status}</span>
                    </div>
                  )}
                  {show.contentRating && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Вікове обмеження</span>
                      <span className="text-white">{show.contentRating}</span>
                    </div>
                  )}
                  {show.numberOfSeasons && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Сезони</span>
                      <span className="text-white">{show.numberOfSeasons}</span>
                    </div>
                  )}
                  {show.latestSeasonNumber !== null && show.latestSeasonNumber !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Останній сезон</span>
                      <span className="text-white">{show.latestSeasonNumber}</span>
                    </div>
                  )}
                  {show.latestSeasonEpisodes !== null &&
                    show.latestSeasonEpisodes !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Епізодів в сезоні</span>
                        <span className="text-white">{show.latestSeasonEpisodes}</span>
                      </div>
                    )}
                  {show.firstAirDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Прем'єра</span>
                      <span className="text-white">
                        {new Date(show.firstAirDate).toLocaleDateString('uk-UA')}
                      </span>
                    </div>
                  )}
                  {show.imdbId && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">IMDb</span>
                      <a
                        href={`https://www.imdb.com/title/${show.imdbId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Відкрити на IMDb
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Back Button */}
              <button
                onClick={() => router.push('/trending')}
                className="w-full px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition"
              >
                ← Назад до трендів
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
