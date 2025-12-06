import React from 'react';
import type { ShowWithUrl } from '@/lib/types';

type Region = string | null;

export function TrendingHero({ show, region }: { show: ShowWithUrl; region?: Region }) {
  if (!show) return null;
  return (
    <div className="relative h-[60vh] overflow-hidden">
      <div className="absolute inset-0">
        {show.posterUrl && (
          <div className="relative w-full h-full">
            <div
              className="absolute inset-0 bg-cover bg-center blur-xl scale-110"
              style={{ backgroundImage: `url(${show.posterUrl})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/40" />
          </div>
        )}
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-12">
        <div className="max-w-2xl">
          <div className="inline-block px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-full mb-4">
            🔥 №1 у трендах зараз
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            {show.titleUk || show.title}
          </h1>
          <p className="text-gray-300 text-lg mb-6 line-clamp-3 break-words">
            {show.overviewUk || show.overview}
          </p>
          <div className="flex items-center space-x-6 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-400 text-xl">⭐</span>
              <span className="text-white text-2xl font-bold">
                {show.ratingTmdb != null ? Number(show.ratingTmdb).toFixed(1) : 'N/A'}
              </span>
              <span className="text-gray-400">TMDB</span>
            </div>
            {show.ratingTrakt != null && (
              <div className="flex items-center space-x-2">
                <span className="text-blue-400 text-xl">👁</span>
                <span className="text-white text-2xl font-bold">
                  {(Number(show.ratingTrakt) / 1000).toFixed(1)}K
                </span>
                <span className="text-gray-400">Глядачі</span>
              </div>
            )}
          </div>
          <a
            href={`/show/${show.id}${region ? `?region=${region}` : ''}`}
            className="inline-block px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition transform hover:scale-105"
          >
            Переглянути деталі →
          </a>
        </div>
      </div>
    </div>
  );
}
