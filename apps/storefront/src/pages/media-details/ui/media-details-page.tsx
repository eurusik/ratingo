import { preload } from 'react-dom';
import { notFound } from 'next/navigation';
import { trackingStateFor, type TrackingHints, type TrackingState } from '@/entities/episode';
import { loadMovieBySlug, loadShowBySlug } from '@/shared/api';
import { DESKTOP_MEDIA_QUERY, PHONE_MEDIA_QUERY } from '@/shared/config';
import type { Locale } from '@/shared/i18n';
import { JsonLd } from '@/shared/lib';
import { movieJsonLd, showJsonLd, type JsonLdData } from '../model/details-seo';
import {
  fromMovieDetails,
  fromShowDetails,
  type MediaDetailsView as View,
} from '../model/details-view';
import { AfterNavigationTransition } from './after-navigation-transition';
import { MediaDetailsView } from './media-details-view';

function preloadBackdrop(view: View): void {
  if (!view.backdropUrl) return;
  preload(view.backdropUrl, { as: 'image', media: PHONE_MEDIA_QUERY, fetchPriority: 'high' });
  preload(view.backdropLargeUrl ?? view.backdropUrl, {
    as: 'image',
    media: DESKTOP_MEDIA_QUERY,
    fetchPriority: 'high',
  });
}

interface DetailsPageProps {
  slug: string;
  locale: Locale;
}

interface ShowDetailsPageProps extends DetailsPageProps {
  trackingHints: TrackingHints | null;
}

function DetailsDocument({
  view,
  jsonLd,
  locale,
  trackingState,
}: {
  view: View;
  jsonLd: JsonLdData;
  locale: Locale;
  trackingState?: TrackingState;
}) {
  preloadBackdrop(view);

  return (
    <>
      <JsonLd data={jsonLd} />
      <AfterNavigationTransition>
        <MediaDetailsView view={view} locale={locale} trackingState={trackingState} />
      </AfterNavigationTransition>
    </>
  );
}

export async function MovieDetailsPage({ slug, locale }: DetailsPageProps) {
  const movie = await loadMovieBySlug(slug);
  if (!movie) notFound();
  return (
    <DetailsDocument view={fromMovieDetails(movie)} jsonLd={movieJsonLd(movie)} locale={locale} />
  );
}

export async function ShowDetailsPage({ slug, locale, trackingHints }: ShowDetailsPageProps) {
  const show = await loadShowBySlug(slug);
  if (!show) notFound();
  return (
    <DetailsDocument
      view={fromShowDetails(show, new Date())}
      jsonLd={showJsonLd(show)}
      locale={locale}
      trackingState={trackingStateFor(trackingHints, show.slug)}
    />
  );
}
