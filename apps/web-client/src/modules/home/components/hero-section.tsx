/**
 * Hero section for homepage - showcases Top-1 hottest media item.
 *
 * Large banner with trailer, stats, and prominent CTA.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Play, TrendingUp, Users, Star } from 'lucide-react';
import { getDictionary, type Locale } from '@/shared/i18n';
import type { MediaCardServerProps } from './media-card/media-card-server';

interface HeroSectionProps {
  item: MediaCardServerProps & {
    backdrop?: { small: string; medium: string; large: string; original: string } | null;
  };
  locale?: Locale;
  className?: string;
}

/**
 * Hero banner showcasing the #1 hottest item.
 */
export function HeroSection({ item, locale = 'uk', className = '' }: HeroSectionProps) {
  const dict = getDictionary(locale);

  if (!item) return null;

  const {
    slug,
    type,
    title,
    poster,
    stats,
    externalRatings,
    showProgress,
    badgeKey,
    ctaType,
  } = item;

  // Use backdrop if available, otherwise poster
  const backdrop = 'backdrop' in item ? item.backdrop : null;
  const heroImage = backdrop?.large || poster?.large;

  // Generate type-safe href
  const href = (type === 'movie' ? `/movies/${slug}` : `/shows/${slug}`) as Route;

  return (
    <section className={`relative w-full overflow-hidden ${className}`}>
      {/* Background Image */}
      {heroImage && (
        <div className="absolute inset-0">
          <Image
            src={heroImage}
            alt={title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-transparent to-zinc-950/80" />
        </div>
      )}

      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full font-semibold">
              <TrendingUp className="w-5 h-5" />
              <span>№1 {dict.home.sections.trending || 'у трендах'}</span>
            </div>

            {showProgress && (
              <div className="text-zinc-300 text-sm">
                {showProgress.label}
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
            {title}
          </h1>

          {/* Stats */}
          <div className="flex items-center gap-6 mb-8">
            {externalRatings?.tmdb && (
              <div className="flex items-center gap-2 text-white">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-xl font-semibold">{externalRatings.tmdb.rating.toFixed(1)}</span>
              </div>
            )}

            {stats?.liveWatchers && (
              <div className="flex items-center gap-2 text-zinc-300">
                <Users className="w-5 h-5" />
                <span>{stats.liveWatchers.toLocaleString()} дивляться</span>
              </div>
            )}

            {stats?.ratingoScore && (
              <div className="px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-lg">
                <span className="text-blue-400 font-semibold">
                  Hype {Math.round(stats.ratingoScore)}
                </span>
              </div>
            )}
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-4">
            <Link
              href={href}
              className="inline-flex items-center gap-3 bg-white text-zinc-950 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-zinc-100 transition-colors shadow-xl"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>
                {ctaType === 'CONTINUE'
                  ? dict.card.cta.continue
                  : dict.card.cta.details}
              </span>
            </Link>

            <Link
              href={href}
              className="inline-flex items-center gap-2 bg-zinc-800/50 backdrop-blur-sm text-white px-6 py-4 rounded-lg font-semibold hover:bg-zinc-700/50 transition-colors border border-zinc-700"
            >
              <span>Більше інфо</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
