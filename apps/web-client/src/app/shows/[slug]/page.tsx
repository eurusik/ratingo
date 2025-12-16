/**
 * Show details page
 */

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
  type BadgeKey,
} from '@/modules/details';

// ISR: Revalidate every hour (balance between fresh data & performance)
export const revalidate = 3600;

interface ShowDetailsPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Extended show type with computed fields for UI.
 */
interface EnrichedShowDetails extends ShowDetailsDto {
  quickPitch: string;
  suitableFor: string[];
  currentSeason?: number;
  currentSeasonEpisodesReleased?: number;
  currentSeasonTotalEpisodes?: number;
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
  // Compute quickPitch from overview (fallback until API provides it)
  const quickPitch = show.overview?.slice(0, 150) || '';

  // Compute suitableFor from genres (fallback until API provides it)
  const suitableFor = (show.genres || []).map(g => g.name).slice(0, 3);

  // Compute current season info from seasons array
  const now = new Date();
  const currentSeasonData = show.seasons
    .filter(s => s.airDate && new Date(s.airDate) <= now)
    .sort((a, b) => b.number - a.number)[0]; // Latest aired season

  const currentSeason = currentSeasonData?.number;
  const currentSeasonTotalEpisodes = currentSeasonData?.episodeCount ?? undefined;

  // For episodes released, we'd need episode-level data from API
  // For now, if season aired fully, assume all episodes released
  const currentSeasonEpisodesReleased = currentSeasonTotalEpisodes;

  // Find primary trailer
  const primaryTrailerKey = show.primaryTrailer?.key || show.videos?.[0]?.key;

  // Use lastAirDate (last aired episode) as releaseDate
  const releaseDate = show.lastAirDate ? new Date(show.lastAirDate).toISOString() : '';

  // Verdict is null until API provides it
  const verdict = null;

  return {
    ...show,
    quickPitch,
    suitableFor,
    currentSeason,
    currentSeasonEpisodesReleased,
    currentSeasonTotalEpisodes,
    badgeKey: undefined, // TODO: compute from API data
    rank: undefined, // TODO: compute from API data
    primaryTrailerKey,
    nextEpisodeDate: undefined, // TODO: compute from nextAirDate
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

        {/* 2. Data Verdict with integrated CTA - "Що думає Ratingo" */}
        <DataVerdict
          type="season_comparison"
          message="Другий сезон стартував слабше першого"
          context="Рейтинг IMDb: 8.0 (S2) vs 8.7 (S1)"
          confidence="high"
          showCta
          ctaProps={{
            isSaved: false,
            hintKey: 'afterAllEpisodes', // Context-specific: wait for all episodes
          }}
          dict={dict}
        />

        {/* 3. Overview - "Про що це" */}
        <section className="space-y-2">
          <p className="text-base md:text-lg text-zinc-200 leading-relaxed">
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
          currentSeason={show.currentSeason}
          currentSeasonEpisodesReleased={show.currentSeasonEpisodesReleased}
          currentSeasonTotalEpisodes={show.currentSeasonTotalEpisodes}
          nextEpisodeDate={show.nextEpisodeDate}
          status={show.status as any}
          totalSeasons={show.totalSeasons ?? undefined}
          totalEpisodes={show.totalEpisodes ?? undefined}
          dict={dict}
        />

        </section>

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 7. Cast & Crew */}
        {show.credits?.cast && show.credits.cast.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {dict.details.cast.title}
            </h2>
            <CastCarousel
              cast={show.credits.cast as any}
              crew={(show.credits.crew || []) as any}
            />
          </section>
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800/50 my-12" />

        {/* 8. Where to watch */}
        {show.availability && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              {dict.details.providers.title}
            </h2>
            <ProvidersList providers={show.availability as any} dict={dict} />
          </section>
        )}
      </div>
      </div>
    </main>
  );
}
