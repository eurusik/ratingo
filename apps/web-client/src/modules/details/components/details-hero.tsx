/**
 * Simplified hero section.
 * Contains: backdrop, poster, title, meta, single Ratingo score.
 * All other elements (external ratings, badges, watchers) moved to content sections.
 */

'use client';

import Image from 'next/image';
import type { Genre, ImageSet, Stats } from '../types';
import { formatYear } from '@/shared/utils/format';
import type { getDictionary } from '@/shared/i18n';
import { HeroBackdrop } from './hero-backdrop';
import { RatingoScore } from './ratingo-score';

export interface DetailsHeroProps {
  title: string;
  originalTitle?: string | null;
  poster?: ImageSet | null;
  backdrop?: ImageSet | null;
  releaseDate: string;
  genres?: Genre[] | null;
  stats?: Stats | null;
  dict: ReturnType<typeof getDictionary>;
}

export function DetailsHero({
  title,
  originalTitle,
  poster,
  backdrop,
  releaseDate,
  genres,
  stats,
  dict,
}: DetailsHeroProps) {
  const rating = stats?.qualityScore;

  return (
    <section className="relative min-h-[45vh] md:min-h-[60vh] flex items-end">
      {/* FULL BACKDROP */}
      <HeroBackdrop backdrop={backdrop} poster={poster} />

      {/* Content */}
      <div className="relative w-full pb-6 md:pb-8 pt-20 md:pt-48">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-4 md:gap-10 items-end">
            {/* Poster */}
            <div className="flex-shrink-0 w-24 md:w-48 lg:w-56">
              <div className="aspect-[2/3] relative rounded-lg md:rounded-xl overflow-hidden bg-zinc-800 shadow-2xl ring-1 ring-white/20">
                {poster?.large && (
                  <Image
                    src={poster.large}
                    alt={title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 128px, (max-width: 1024px) 192px, 224px"
                    priority
                  />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-3 md:space-y-5">
              {/* Title */}
              <div>
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight drop-shadow-lg">
                  {title}
                </h1>
                {originalTitle && originalTitle !== title && (
                  <p className="text-sm md:text-lg text-zinc-400 mt-1">{originalTitle}</p>
                )}
              </div>

              {/* Meta line */}
              <p className="text-sm md:text-base text-zinc-300">
                {formatYear(releaseDate)}
                {genres && genres.length > 0 && ` • ${genres.map((g) => g.name).join(', ')}`}
              </p>

              {/* Ratingo score with label and subtitle */}
              {rating != null && <RatingoScore score={rating} dict={dict} />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
