'use client';

import Image from 'next/image';
import { Loader2 } from 'lucide-react';

interface DetailsSkeletonProps {
  title: string;
  poster?: string;
  year?: string;
  type: 'movie' | 'show';
  statusMessage: string;
  statusHint: string;
}

/**
 * Skeleton that mimics the details page layout while importing.
 * Shows real poster/title if available, with skeleton placeholders for other content.
 */
export function DetailsSkeleton({
  title,
  poster,
  year,
  type,
  statusMessage,
  statusHint,
}: DetailsSkeletonProps) {
  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Hero section skeleton - matches DetailsHero layout */}
      <section className="relative min-h-[70vh] md:min-h-[60vh] flex items-end">
        {/* Backdrop skeleton */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950">
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
        </div>

        {/* Hero content - same max-w-4xl as DetailsHero */}
        <div className="relative w-full pb-8 pt-32 md:pt-48">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex gap-6 md:gap-10 items-end">
              {/* Poster - same sizes as DetailsHero */}
              <div className="flex-shrink-0 w-32 md:w-48 lg:w-56">
                <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-zinc-800 shadow-2xl ring-1 ring-white/20">
                  {poster ? (
                    <>
                      <Image
                        src={poster}
                        alt={title}
                        fill
                        className="object-cover"
                        priority
                      />
                      {/* Import overlay */}
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
                        <span className="text-sm font-medium text-white">{statusMessage}</span>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
                      <span className="text-sm font-medium text-zinc-300">{statusMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info - same structure as DetailsHero */}
              <div className="flex-1 min-w-0 space-y-4 md:space-y-5">
                {/* Title */}
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight drop-shadow-lg">
                    {title || <span className="inline-block h-10 bg-zinc-800 rounded animate-pulse w-64" />}
                  </h1>
                </div>

                {/* Meta line */}
                {year ? (
                  <p className="text-sm md:text-base text-zinc-300">{year}</p>
                ) : (
                  <div className="h-5 bg-zinc-800 rounded animate-pulse w-32" />
                )}

                {/* Import status banner */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500 shrink-0" />
                  <div>
                    <p className="text-amber-500 font-medium">{statusMessage}</p>
                    <p className="text-zinc-400 text-sm">{statusHint}</p>
                  </div>
                </div>

                {/* Skeleton ratings */}
                <div className="flex flex-wrap gap-2">
                  <div className="h-8 w-16 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-8 w-20 bg-zinc-800 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-zinc-800 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content section skeleton - same max-w-4xl as DetailsContent */}
      <div className="bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Quick pitch skeleton */}
        <div className="mb-8">
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4 mb-2" />
          <div className="h-4 bg-zinc-800 rounded animate-pulse w-1/2" />
        </div>

        {/* Verdict skeleton */}
        <div className="bg-zinc-900/50 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-800 rounded-full animate-pulse" />
            <div className="flex-1">
              <div className="h-5 bg-zinc-800 rounded animate-pulse w-48 mb-2" />
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-32" />
            </div>
          </div>
        </div>

        {/* Overview skeleton */}
        <div className="mb-8">
          <div className="h-6 bg-zinc-800 rounded animate-pulse w-32 mb-4" />
          <div className="space-y-2">
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-full" />
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-full" />
            <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-zinc-800/50 my-12" />

        {/* Trailers skeleton */}
        <div className="mb-8">
          <div className="h-6 bg-zinc-800 rounded animate-pulse w-24 mb-4" />
          <div className="aspect-video bg-zinc-800 rounded-xl animate-pulse" />
        </div>

        {/* Separator */}
        <div className="h-px bg-zinc-800/50 my-12" />

        {/* Cast skeleton */}
        <div className="mb-8">
          <div className="h-6 bg-zinc-800 rounded animate-pulse w-20 mb-4" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex-shrink-0 w-32">
                <div className="w-32 h-32 bg-zinc-800 rounded-full animate-pulse mb-2" />
                <div className="h-4 bg-zinc-800 rounded animate-pulse w-24 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
