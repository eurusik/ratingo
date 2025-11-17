import React from 'react';
import { Star, Eye } from 'lucide-react';

interface HeroProps {
  title: string;
  overview?: string | null;
  posterUrl?: string | null;
  rating?: number | null;
  watchers?: number | null;
  badge?: string; // e.g., "🔥 №1 у трендах зараз"
  href: string;
  buttonText?: string;
}

export function Hero({
  title,
  overview,
  posterUrl,
  rating,
  watchers,
  badge,
  href,
  buttonText = 'Переглянути деталі →',
}: HeroProps) {
  return (
    <div className="relative h-[60vh] overflow-hidden" suppressHydrationWarning>
      {/* Background */}
      <div className="absolute inset-0" suppressHydrationWarning>
        {posterUrl && (
          <div className="relative w-full h-full" suppressHydrationWarning>
            <div
              className="absolute inset-0 bg-cover bg-center blur-xl scale-110"
              style={{ backgroundImage: `url(${posterUrl})` }}
              suppressHydrationWarning
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-zinc-950/40"
              suppressHydrationWarning
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-12"
        suppressHydrationWarning
      >
        <div className="max-w-2xl" suppressHydrationWarning>
          {/* Badge */}
          {badge && (
            <div className="inline-block px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-full mb-4">
              {badge}
            </div>
          )}

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">{title}</h1>

          {/* Overview */}
          {overview && (
            <p className="text-gray-300 text-lg mb-6 line-clamp-3 break-words">{overview}</p>
          )}

          {/* Stats */}
          <div className="flex items-center space-x-6 mb-6">
            {rating != null && (
              <div className="flex items-center space-x-2">
                <Star className="text-yellow-400 w-6 h-6 fill-yellow-400" />
                <span className="text-white text-2xl font-bold">{rating.toFixed(1)}</span>
                <span className="text-gray-400">TMDB</span>
              </div>
            )}

            {watchers != null && (
              <div className="flex items-center space-x-2">
                <Eye className="text-blue-400 w-6 h-6" />
                <span className="text-white text-2xl font-bold">
                  {(watchers / 1000).toFixed(1)}K
                </span>
                <span className="text-gray-400">Глядачі</span>
              </div>
            )}
          </div>

          {/* CTA Button */}
          <a
            href={href}
            className="inline-block px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition transform hover:scale-105"
          >
            {buttonText}
          </a>
        </div>
      </div>
    </div>
  );
}
