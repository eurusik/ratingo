/**
 * Movie details page
 *
 */

import type { Metadata } from 'next';
import { Film } from 'lucide-react';
import { getDictionary } from '@/shared/i18n';
import { createMediaMetadata, createNotFoundMetadata } from '@/shared/utils';
import { catalogApi, type MovieDetailsDto } from '@/core/api';
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
  DataVerdict,
  MovieRelease,
  type BadgeKey,
  type MovieVerdict,
  type MovieVerdictMessageKey,
} from '@/modules/details';
import { Separator } from '@/shared/ui';

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
  } catch {
    return (
      <NotFoundView
        icon={Film}
        message={dict.errors.notFound}
        backLabel={dict.details.backToHome}
      />
    );
  }

  // Enrich with computed fields
  const movie = enrichMovieDetails(apiMovie);

  // Get verdict for rendering
  const verdict = (movie as { verdict?: MovieVerdict }).verdict;
  const verdictMessage = verdict?.messageKey 
    ? dict.details.verdict.movie[verdict.messageKey as MovieVerdictMessageKey]
    : null;

  return (
    <DetailsPageClient breadcrumb={dict.browse.movies.title} backUrl="/browse/movies">
      <main className="min-h-screen">
        <DetailsHero
        title={movie.title}
        originalTitle={movie.originalTitle}
        poster={movie.poster}
        backdrop={movie.backdrop}
        releaseDate={movie.releaseDate}
        genres={movie.genres}
        stats={movie.stats}
        externalRatings={movie.externalRatings}
        badgeKey={movie.badgeKey}
        rank={movie.rank}
        quickPitch={movie.quickPitch}
        dict={dict}
      />

      <DetailsContent>
        <SuitableForTags 
          tags={movie.suitableFor} 
          label={dict.details.quickPitch.suitable} 
        />

        {verdict && verdictMessage && (
          <DataVerdict
            mediaItemId={movie.id}
            type={verdict.type}
            message={verdictMessage}
            messageKey={verdict.messageKey}
            context={verdict.context ?? undefined}
            showCta
            ctaProps={{
              hintKey: verdict.hintKey,
              primaryCta: movie.card?.primaryCta,
            }}
            dict={dict}
          />
        )}

        <OverviewSection 
          title={dict.details.overview.title} 
          overview={movie.overview} 
        />

        <Separator className="my-12 bg-zinc-800/50" />

        <TrailersSection
          title={dict.details.trailer.sectionTitle}
          videos={movie.videos}
          primaryTrailerKey={movie.primaryTrailerKey}
        />

        <MovieRelease
          releaseDate={movie.releaseDate}
          digitalReleaseDate={movie.digitalReleaseDate ?? undefined}
          runtime={(movie as any).runtime ?? undefined}
          dict={dict}
        />

        <Separator className="my-12 bg-zinc-800/50" />

        <CastCrewSection 
          cast={movie.credits?.cast} 
          crew={movie.credits?.crew} 
        />

        <ProvidersSection
          title={dict.details.providers.title}
          availability={movie.availability}
          dict={dict}
        />
      </DetailsContent>
      </main>
    </DetailsPageClient>
  );
}
