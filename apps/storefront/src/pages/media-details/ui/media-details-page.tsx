import { preload } from 'react-dom';
import { notFound } from 'next/navigation';
import type { Locale } from '@/shared/i18n';
import { JsonLd } from '@/shared/lib';
import { loadMovie, loadShow } from '../api/load-media-details';
import { movieJsonLd, showJsonLd } from '../model/details-seo';
import {
  fromMovieDetails,
  fromShowDetails,
  type MediaDetailsView as View,
} from '../model/details-view';
import { MediaDetailsView } from './media-details-view';

const DESKTOP_MEDIA = '(min-width: 48rem)';
const PHONE_MEDIA = '(max-width: 47.99rem)';

function preloadBackdrop(view: View): void {
  if (!view.backdropUrl) return;
  preload(view.backdropUrl, { as: 'image', media: PHONE_MEDIA, fetchPriority: 'high' });
  preload(view.backdropLargeUrl ?? view.backdropUrl, {
    as: 'image',
    media: DESKTOP_MEDIA,
    fetchPriority: 'high',
  });
}

interface DetailsPageProps {
  slug: string;
  locale: Locale;
}

export async function MovieDetailsPage({ slug, locale }: DetailsPageProps) {
  const movie = await loadMovie(slug);
  if (!movie) notFound();
  const view = fromMovieDetails(movie);
  preloadBackdrop(view);

  return (
    <>
      <JsonLd data={movieJsonLd(movie)} />
      <MediaDetailsView view={view} locale={locale} />
    </>
  );
}

export async function ShowDetailsPage({ slug, locale }: DetailsPageProps) {
  const show = await loadShow(slug);
  if (!show) notFound();
  const view = fromShowDetails(show);
  preloadBackdrop(view);

  return (
    <>
      <JsonLd data={showJsonLd(show)} />
      <MediaDetailsView view={view} locale={locale} />
    </>
  );
}
