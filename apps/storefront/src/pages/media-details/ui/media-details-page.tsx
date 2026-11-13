import { notFound } from 'next/navigation';
import { JsonLd } from '@/shared/lib';
import { loadMovie, loadShow } from '../api/load-media-details';
import { movieJsonLd, showJsonLd } from '../model/details-seo';
import { fromMovieDetails, fromShowDetails } from '../model/details-view';
import { MediaDetailsView } from './media-details-view';

export async function MovieDetailsPage({ slug }: { slug: string }) {
  const movie = await loadMovie(slug);
  if (!movie) notFound();

  return (
    <>
      <JsonLd data={movieJsonLd(movie)} />
      <MediaDetailsView view={fromMovieDetails(movie)} />
    </>
  );
}

export async function ShowDetailsPage({ slug }: { slug: string }) {
  const show = await loadShow(slug);
  if (!show) notFound();

  return (
    <>
      <JsonLd data={showJsonLd(show)} />
      <MediaDetailsView view={fromShowDetails(show)} />
    </>
  );
}
