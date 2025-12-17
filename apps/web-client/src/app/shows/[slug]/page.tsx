/**
 * Show details page
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Tv, Share2 } from 'lucide-react';
import { getDictionary } from '@/shared/i18n';
import { catalogApi, type ShowDetailsDto } from '@/core/api';
import {
  DetailsHero,
  DetailsCtaRow,
  ShowStatus,
  ProvidersList,
  DataVerdict,
  TrailersCarousel,
  CastCarousel,
  CrewCarousel,
  type BadgeKey,
} from '@/modules/details';

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
  
  try {
    const show = await catalogApi.getShowBySlug(slug);
    const title = show.title;
    const description = show.overview?.slice(0, 160) || `Дивіться ${show.title} на Ratingo`;
    const posterUrl = show.poster?.large;

    return {
      title,
      description,
      openGraph: {
        title: `${title} | Ratingo`,
        description,
        type: 'video.tv_show',
        images: posterUrl ? [{ url: posterUrl, width: 500, height: 750 }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: posterUrl ? [posterUrl] : [],
      },
    };
  } catch {
    return {
      title: 'Серіал не знайдено',
      description: 'Серіал не знайдено на Ratingo',
    };
  }
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
  verdict?: {
    type: 'season_comparison' | 'user_context' | 'general';
    message: string;
    context: string;
    confidence: 'high' | 'medium' | 'low';
  } | null;
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

  // Verdict is null until API provides it
  const verdict = null;

  return {
    ...show,
    quickPitch,
    suitableFor,
    badgeKey,
    rank,
    primaryTrailerKey,
    nextEpisodeDate,
    releaseDate,
    verdict,
  };
}


export default async function ShowDetailsPage({ params }: ShowDetailsPageProps) {
  const { slug } = await params;
  const dict = getDictionary('uk');
  
  // Fetch show from API
  let apiShow: ShowDetailsDto;
  try {
    apiShow = await catalogApi.getShowBySlug(slug);
  } catch (error) {
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
        <DataVerdict
          type="season_comparison"
          message="Другий сезон стартував слабше першого"
          context="Рейтинг IMDb: 8.0 (S2) vs 8.7 (S1)"
          confidence="high"
          showCta
          ctaProps={{
            isSaved: false,
            hintKey: 'afterAllEpisodes',
            primaryCta: show.card?.primaryCta,
            continuePoint: show.card?.continue,
          }}
          dict={dict}
        />

        {/* 3. Full Overview - Complete description */}
        <section id="overview-section" className="space-y-2 scroll-mt-8">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            {dict.details.overview.title}
          </h3>
          <p className="text-base md:text-lg text-zinc-300 leading-relaxed">
            {show.overview}
          </p>
        </section>

        {/* 4. Standalone CTA for shows without verdict */}
        {false && (
          <DetailsCtaRow
            hasNewEpisodes={show.badgeKey === 'NEW_EPISODE'}
            dict={dict}
          />
        )}

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
