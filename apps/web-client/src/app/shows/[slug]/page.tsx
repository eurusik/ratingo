/**
 * Show details page
 */

import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { Tv, ArrowLeft, Share2 } from 'lucide-react';
import { getDictionary } from '@/shared/i18n';
import { createMediaMetadata, createNotFoundMetadata } from '@/shared/utils';
import { catalogApi, type ShowDetailsDto } from '@/core/api';
import {
  DetailsHero,
  ShowStatus,
  ProvidersList,
  DataVerdict,
  TrailersCarousel,
  CastCarousel,
  CrewCarousel,
  type BadgeKey,
} from '@/modules/details';

/**
 * Cached show fetcher - deduplicates requests within same render.
 * React cache ensures generateMetadata and page component share the same request.
 */
const getShow = cache(async (slug: string): Promise<ShowDetailsDto | null> => {
  try {
    return await catalogApi.getShowBySlug(slug);
  } catch {
    return null;
  }
});

// ISR: Revalidate every hour (balance between fresh data & performance)
export const revalidate = 3600;

interface PageParams {
  params: Promise<{ slug: string }>;
}

/**
 * Dynamic metadata for SEO.
 */
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const show = await getShow(slug);
  
  if (!show) {
    return createNotFoundMetadata('show');
  }
  return createMediaMetadata(show, { type: 'show' });
}

interface ShowDetailsPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Extended show type with computed fields for UI.
 */
interface EnrichedShowDetails extends ShowDetailsDto {
  quickPitch: string;
  suitableFor: string[];
  badgeKey?: BadgeKey;
  rank?: number;
  primaryTrailerKey?: string;
  nextEpisodeDate?: string;
  releaseDate: string;
}

/**
 * Enriches API response with computed UI fields.
 */
function enrichShowDetails(show: ShowDetailsDto): EnrichedShowDetails {
  // Compute quickPitch: Take FIRST sentence only (not overview!)
  // Quick pitch should be a short verdict, not plot description
  const firstSentence = show.overview?.split(/[.!?]\s+/)[0];
  const quickPitch = firstSentence 
    ? (firstSentence.length > 120 
        ? firstSentence.slice(0, 120) + '...' 
        : firstSentence + '...')  // Always add ellipsis to hint there's more
    : '';

  // Compute suitableFor from genres (fallback until API provides it)
  const suitableFor = (show.genres || []).map(g => g.name).slice(0, 3);

  // Use API's primaryTrailer if available, fallback to first video
  const primaryTrailerKey = show.primaryTrailer?.key || show.videos?.[0]?.key;

  // Use releaseDate directly from API (already in ISO format)
  const releaseDate = show.releaseDate || '';

  // Use nextAirDate directly from API (already in ISO format)
  const nextEpisodeDate = show.nextAirDate || undefined;

  // Use ratingoScore as rank (0-100 composite score)
  const rank = show.stats?.ratingoScore ? Math.round(show.stats.ratingoScore) : undefined;

  // Use card.badgeKey from API (behavioral context from backend)
  const badgeKey = show.card?.badgeKey || undefined;

  return {
    ...show,
    quickPitch,
    suitableFor,
    badgeKey,
    rank,
    primaryTrailerKey,
    nextEpisodeDate,
    releaseDate,
  };
}


export default async function ShowDetailsPage({ params }: ShowDetailsPageProps) {
  const { slug } = await params;
  const dict = getDictionary('uk');
  
  // Fetch show from API (uses React cache - deduped with generateMetadata)
  const apiShow = await getShow(slug);
  
  if (!apiShow) {
    // Show not found or API error
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Tv className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{dict.errors.notFound}</h1>
          <Link href={'/' as Route} className="text-blue-400 hover:text-blue-300">
            ← {dict.details.backToHome}
          </Link>
        </div>
      </main>
    );
  }

  // Enrich with computed fields
  const show = enrichShowDetails(apiShow);

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
        title={show.title}
        originalTitle={show.originalTitle ?? undefined}
        poster={(show.poster ?? undefined) as any}
        backdrop={(show.backdrop ?? undefined) as any}
        releaseDate={show.releaseDate}
        genres={show.genres ?? []}
        stats={(show.stats ?? undefined) as any}
        externalRatings={(show.externalRatings ?? undefined) as any}
        badgeKey={show.badgeKey}
        rank={show.rank}
        quickPitch={show.quickPitch}
        dict={dict}
      />

      <div className="bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* 1. "Suitable for" tags - FIRST, before verdict */}
        {show.suitableFor && show.suitableFor.length > 0 && (
          <section className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              {dict.details.quickPitch.suitable}:
            </span>
            {show.suitableFor.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/60 rounded-full border border-zinc-700/50"
              >
                {tag}
              </span>
            ))}
          </section>
        )}

        {/* 2. Data Verdict with integrated CTA - Details only */}
        {apiShow.verdict?.messageKey && (
          <DataVerdict
            mediaItemId={show.id}
            type={apiShow.verdict.type as any}
            message={dict.details.verdict.show[apiShow.verdict.messageKey as keyof typeof dict.details.verdict.show] || ''}
            context={apiShow.statusHint?.messageKey 
              ? dict.details.verdict.showStatusHint[apiShow.statusHint.messageKey as keyof typeof dict.details.verdict.showStatusHint]
              : apiShow.verdict.context || undefined}
            showCta
            ctaProps={{
              hintKey: apiShow.verdict.hintKey as any,
              primaryCta: show.card?.primaryCta,
              continuePoint: show.card?.continue,
            }}
            dict={dict}
          />
        )}

        {/* 3. Full Overview - Complete description */}
        <section id="overview-section" className="space-y-2 scroll-mt-8">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            {dict.details.overview.title}
          </h3>
          <p className="text-base md:text-lg text-zinc-300 leading-relaxed">
            {show.overview}
          </p>
        </section>

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 5. Trailers carousel */}
        {show.videos && show.videos.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {dict.details.trailer.sectionTitle}
            </h2>
            <TrailersCarousel
              videos={show.videos}
              primaryTrailer={show.videos.find(v => v.key === show.primaryTrailerKey)}
            />
          </section>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 6. Show status - Episodes section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            {dict.details.showStatus.sectionTitle}
          </h2>
          <ShowStatus
            nextEpisodeDate={show.nextEpisodeDate}
            totalSeasons={show.totalSeasons ?? undefined}
            totalEpisodes={show.totalEpisodes ?? undefined}
            dict={dict}
          />
        </section>

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 7. Cast & Crew - Combined section */}
        {((show.credits?.cast && show.credits.cast.length > 0) || 
          (show.credits?.crew && show.credits.crew.length > 0)) && (
          <div className="space-y-8">
            {/* Cast */}
            {show.credits?.cast && show.credits.cast.length > 0 && (
              <CastCarousel
                cast={show.credits.cast as any}
                crew={(show.credits.crew || []) as any}
              />
            )}

            {/* Crew */}
            {show.credits?.crew && show.credits.crew.length > 0 && (
              <CrewCarousel crew={show.credits.crew as any} />
            )}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 8. Where to watch */}
        {show.availability && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {dict.details.providers.title}
            </h2>
            <ProvidersList providers={show.availability} dict={dict} />
          </section>
        )}
      </div>
      </div>
    </main>
  );
}
