/**
 * Show details page
 */

import { cache } from 'react';
import type { Metadata } from 'next';
import { Tv } from 'lucide-react';
import { getDictionary } from '@/shared/i18n';
import { createMediaMetadata, createNotFoundMetadata } from '@/shared/utils';
import { catalogApi, type ShowDetailsDto } from '@/core/api';
import {
  DetailsHero,
  DetailsContent,
  DetailsPageClient,
  SuitableForTags,
  OverviewSection,
  TrailersSection,
  CastCrewSection,
  ProvidersSection,
  NotFoundView,
  ShowStatus,
  DataVerdict,
  type BadgeKey,
} from '@/modules/details';
import { Separator } from '@/shared/ui';

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
    return (
      <NotFoundView
        icon={Tv}
        message={dict.errors.notFound}
        backLabel={dict.details.backToHome}
      />
    );
  }

  // Enrich with computed fields
  const show = enrichShowDetails(apiShow);

  // Get verdict message
  const verdictMessage = apiShow.verdict?.messageKey
    ? dict.details.verdict.show[apiShow.verdict.messageKey as keyof typeof dict.details.verdict.show] || ''
    : null;

  // Get status hint context
  const verdictContext = apiShow.statusHint?.messageKey 
    ? dict.details.verdict.showStatusHint[apiShow.statusHint.messageKey as keyof typeof dict.details.verdict.showStatusHint]
    : apiShow.verdict?.context || undefined;

  return (
    <DetailsPageClient breadcrumb={dict.browse.shows.title} backUrl="/browse/shows">
      <main className="min-h-screen">
        <DetailsHero
        title={show.title}
        originalTitle={show.originalTitle}
        poster={show.poster}
        backdrop={show.backdrop}
        releaseDate={show.releaseDate}
        genres={show.genres}
        stats={show.stats}
        externalRatings={show.externalRatings}
        badgeKey={show.badgeKey}
        rank={show.rank}
        quickPitch={show.quickPitch}
        dict={dict}
      />

      <DetailsContent>
        <SuitableForTags 
          tags={show.suitableFor} 
          label={dict.details.quickPitch.suitable} 
        />

        {apiShow.verdict?.messageKey && verdictMessage && (
          <DataVerdict
            mediaItemId={show.id}
            type={apiShow.verdict.type}
            message={verdictMessage}
            context={verdictContext}
            showCta
            ctaProps={{
              hintKey: apiShow.verdict.hintKey,
              primaryCta: show.card?.primaryCta,
              continuePoint: show.card?.continue,
            }}
            dict={dict}
          />
        )}

        <OverviewSection 
          title={dict.details.overview.title} 
          overview={show.overview} 
        />

        <Separator className="my-12 bg-zinc-800/50" />

        <TrailersSection
          title={dict.details.trailer.sectionTitle}
          videos={show.videos}
          primaryTrailerKey={show.primaryTrailerKey}
        />

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

        <Separator className="my-12 bg-zinc-800/50" />

        <CastCrewSection 
          cast={show.credits?.cast} 
          crew={show.credits?.crew} 
        />

        <ProvidersSection
          title={dict.details.providers.title}
          availability={show.availability}
          dict={dict}
        />
      </DetailsContent>
      </main>
    </DetailsPageClient>
  );
}
