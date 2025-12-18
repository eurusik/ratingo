/**
 * Hero section for homepage - showcases Top-1 hottest media item.
 *
 * Large banner with trailer, stats, and prominent CTA.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Play, TrendingUp, Star, Activity } from 'lucide-react';
import { type PrimaryCta, PRIMARY_CTA } from '@/shared/types';
import { getDictionary, type Locale } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import type { MediaCardServerProps } from './media-card/media-card-server';

interface HeroSectionProps {
  item: MediaCardServerProps & {
    backdrop?: { small: string; medium: string; large: string; original: string } | null;
    ctaType?: PrimaryCta;
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
            {/* Ratingo Score */}
            {stats?.qualityScore && (
              <div className="flex items-center gap-2 text-white">
                <Activity className="w-5 h-5 text-blue-400" />
                <span className="text-xl font-semibold">{(stats.qualityScore / 10).toFixed(1)}</span>
              </div>
            )}

            {/* IMDb (пріоритет) або TMDB */}
            {externalRatings?.imdb ? (
              <div className="flex items-center gap-2 text-white">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-xl font-semibold">{externalRatings.imdb.rating.toFixed(1)}</span>
                <span className="text-sm text-zinc-400">IMDb</span>
              </div>
            ) : externalRatings?.tmdb ? (
              <div className="flex items-center gap-2 text-white">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-xl font-semibold">{externalRatings.tmdb.rating.toFixed(1)}</span>
                <span className="text-sm text-zinc-400">TMDB</span>
              </div>
            ) : null}

            {/* Interest */}
            {stats?.liveWatchers && (
              <div className="flex items-center gap-2 text-zinc-300">
                <TrendingUp className="w-5 h-5" />
                <span>{stats.liveWatchers.toLocaleString()}</span>
                <span className="text-sm text-zinc-400">{dict.details.watchingNow}</span>
              </div>
            )}
          </div>

          {/* CTA - Single button */}
          <div className="flex items-center gap-4">
            <Button
              size="lg"
              className="bg-white text-zinc-950 hover:bg-zinc-100 px-8 py-6 text-lg shadow-xl"
              asChild
            >
              <Link href={href}>
                <Play className="w-6 h-6 fill-current mr-3" />
                {ctaType === PRIMARY_CTA.CONTINUE
                  ? dict.card.cta.continue
                  : dict.card.cta.details}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
