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
      {/* Hero section skeleton */}
      <div className="relative">
        {/* Backdrop skeleton */}
        <div className="absolute inset-0 h-[70vh] bg-gradient-to-b from-zinc-900 to-zinc-950">
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
        </div>

        {/* Hero content */}
        <div className="relative z-10 container mx-auto px-4 pt-24 pb-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <div className="relative w-48 md:w-64 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl bg-zinc-800">
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

            {/* Info */}
            <div className="flex-1 flex flex-col justify-end gap-4">
              {/* Title */}
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {title || <div className="h-10 bg-zinc-800 rounded animate-pulse w-64" />}
                </h1>
                {year && (
                  <p className="text-zinc-400 text-lg">{year}</p>
                )}
              </div>

              {/* Import status banner */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500 shrink-0" />
                <div>
                  <p className="text-amber-500 font-medium">{statusMessage}</p>
                  <p className="text-zinc-400 text-sm">{statusHint}</p>
                </div>
              </div>

              {/* Skeleton ratings */}
              <div className="flex gap-4">
                <div className="h-12 w-20 bg-zinc-800 rounded animate-pulse" />
                <div className="h-12 w-20 bg-zinc-800 rounded animate-pulse" />
                <div className="h-12 w-20 bg-zinc-800 rounded animate-pulse" />
              </div>

              {/* Skeleton genres */}
              <div className="flex gap-2">
                <div className="h-6 w-16 bg-zinc-800 rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-zinc-800 rounded-full animate-pulse" />
                <div className="h-6 w-14 bg-zinc-800 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content section skeleton */}
      <div className="container mx-auto px-4 py-8">
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
    </main>
  );
}
