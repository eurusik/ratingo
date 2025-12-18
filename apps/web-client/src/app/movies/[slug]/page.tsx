/**
 * Movie details page
 *
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Film, Share2 } from 'lucide-react';
import { getDictionary } from '@/shared/i18n';
import { createMediaMetadata, createNotFoundMetadata } from '@/shared/utils';
import { catalogApi, type MovieDetailsDto } from '@/core/api';
import {
  DetailsHero,
  DataVerdict,
  MovieRelease,
  ProvidersList,
  TrailersCarousel,
  CastCarousel,
  CrewCarousel,
  type BadgeKey,
  type MovieVerdict,
  type MovieVerdictMessageKey,
} from '@/modules/details';

// ISR: Revalidate every hour
export const revalidate = 3600;

interface PageParams {
  params: Promise<{ slug: string }>;
}

/**
 * Dynamic metadata for SEO.
 */
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  
  try {
    const movie = await catalogApi.getMovieBySlug(slug);
    return createMediaMetadata(movie, { type: 'movie' });
  } catch {
    return createNotFoundMetadata('movie');
  }
}

interface MovieDetailsPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Extended movie type with computed fields for UI.
 */
interface EnrichedMovieDetails extends MovieDetailsDto {
  quickPitch: string;
  suitableFor: string[];
  badgeKey?: BadgeKey;
  rank?: number;
  primaryTrailerKey?: string;
  releaseDate: string;
  digitalReleaseDate?: string | null;
}

/**
 * Enriches API response with computed UI fields.
 */
function enrichMovieDetails(movie: MovieDetailsDto): EnrichedMovieDetails {
  // Compute quickPitch: Take FIRST sentence only
  const firstSentence = movie.overview?.split(/[.!?]\s+/)[0];
  const quickPitch = firstSentence 
    ? (firstSentence.length > 120 
        ? firstSentence.slice(0, 120) + '...' 
        : firstSentence + '...')
    : '';

  // Compute suitableFor from genres
  const suitableFor = (movie.genres || []).map(g => g.name).slice(0, 3);

  // Use API's primaryTrailer if available, fallback to first video
  const primaryTrailerKey = movie.primaryTrailer?.key || movie.videos?.[0]?.key;

  // Use releaseDate directly from API
  const releaseDate = movie.releaseDate || '';

  // Use ratingoScore as rank
  const rank = movie.stats?.ratingoScore ? Math.round(movie.stats.ratingoScore) : undefined;

  // Use card.badgeKey from API
  const badgeKey = movie.card?.badgeKey || undefined;

  // Use digitalReleaseDate from API (cast to any since contract may not have it yet)
  const digitalReleaseDate = (movie as any).digitalReleaseDate || null;

  return {
    ...movie,
    quickPitch,
    suitableFor,
    badgeKey,
    rank,
    primaryTrailerKey,
    releaseDate,
    digitalReleaseDate,
  };
}

export default async function MovieDetailsPage({ params }: MovieDetailsPageProps) {
  const { slug } = await params;
  const dict = getDictionary('uk');

  // Fetch movie from API
  let apiMovie: MovieDetailsDto;
  try {
    apiMovie = await catalogApi.getMovieBySlug(slug);
  } catch (error) {
    // Movie not found or API error
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Film className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{dict.errors.notFound}</h1>
          <Link href={'/' as Route} className="text-blue-400 hover:text-blue-300">
            ← {dict.details.backToHome}
          </Link>
        </div>
      </main>
    );
  }

  // Enrich with computed fields
  const movie = enrichMovieDetails(apiMovie);

  return (
    <main className="min-h-screen">
      {/* 0. App bar */}
      <header className="sticky top-0 z-50 bg-transparent backdrop-blur border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={'/' as Route}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">{dict.details.backToHome}</span>
          </Link>
          <button className="text-zinc-400 hover:text-white transition-colors p-2">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 1. Hero with Quick Pitch - FULL WIDTH */}
      <DetailsHero
        title={movie.title}
        originalTitle={movie.originalTitle ?? undefined}
        poster={(movie.poster ?? undefined) as any}
        backdrop={(movie.backdrop ?? undefined) as any}
        releaseDate={movie.releaseDate}
        genres={movie.genres ?? []}
        stats={(movie.stats ?? undefined) as any}
        externalRatings={(movie.externalRatings ?? undefined) as any}
        badgeKey={movie.badgeKey}
        rank={movie.rank}
        quickPitch={movie.quickPitch}
        dict={dict}
      />

      <div className="bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* 1. "Suitable for" tags */}
        {movie.suitableFor && movie.suitableFor.length > 0 && (
          <section className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              {dict.details.quickPitch.suitable}:
            </span>
            {movie.suitableFor.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/60 rounded-full border border-zinc-700/50"
              >
                {tag}
              </span>
            ))}
          </section>
        )}

        {/* 2. Data Verdict with CTA */}
        {(() => {
          // Use verdict from API (backend-computed)
          const verdict = (movie as { verdict?: MovieVerdict }).verdict;
          if (!verdict || !verdict.messageKey) return null;
          
          const message = dict.details.verdict.movie[verdict.messageKey as MovieVerdictMessageKey];
          return (
            <DataVerdict
              mediaItemId={movie.id}
              type={verdict.type}
              message={message}
              context={verdict.context ?? undefined}
              showCta
              ctaProps={{
                hintKey: verdict.hintKey,
                primaryCta: movie.card?.primaryCta,
              }}
              dict={dict}
            />
          );
        })()}

        {/* 3. Full Overview */}
        <section id="overview-section" className="space-y-2 scroll-mt-8">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            {dict.details.overview.title}
          </h3>
          <p className="text-base md:text-lg text-zinc-300 leading-relaxed">
            {movie.overview}
          </p>
        </section>

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 4. Trailers carousel */}
        {movie.videos && movie.videos.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {dict.details.trailer.sectionTitle}
            </h2>
            <TrailersCarousel
              videos={movie.videos}
              primaryTrailer={movie.videos.find(v => v.key === movie.primaryTrailerKey)}
            />
          </section>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 5. Movie release & runtime */}
        <MovieRelease
          releaseDate={movie.releaseDate}
          digitalReleaseDate={movie.digitalReleaseDate ?? undefined}
          runtime={(movie as any).runtime ?? undefined}
          dict={dict}
        />

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 6. Cast & Crew */}
        {((movie.credits?.cast && movie.credits.cast.length > 0) || 
          (movie.credits?.crew && movie.credits.crew.length > 0)) && (
          <div className="space-y-8">
            {/* Cast */}
            {movie.credits?.cast && movie.credits.cast.length > 0 && (
              <CastCarousel
                cast={movie.credits.cast as any}
                crew={(movie.credits.crew || []) as any}
              />
            )}

            {/* Crew */}
            {movie.credits?.crew && movie.credits.crew.length > 0 && (
              <CrewCarousel crew={movie.credits.crew as any} />
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 7. Where to watch */}
        {movie.availability && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {dict.details.providers.title}
            </h2>
            <ProvidersList providers={movie.availability} dict={dict} />
          </section>
        )}
      </div>
      </div>
    </main>
  );
}
