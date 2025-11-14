import { notFound } from 'next/navigation';
import { getShowDetails } from '@/lib/queries/shows';
import { ClientShowDetail } from './ClientShowDetail';
import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const showId = parseInt(id, 10);

  if (isNaN(showId)) {
    return {
      title: 'Серіал не знайдено',
    };
  }

  const show = await getShowDetails(showId);

  if (!show) {
    return {
      title: 'Серіал не знайдено',
    };
  }

  const title = (show as any).titleUk || show.title;
  const description = ((show as any).overviewUk || show.overview || 'Детальна інформація про серіал').slice(0, 160);
  const rating = (show as any).primaryRating || show.ratingTmdb || (show as any).ratingTraktAvg || show.ratingImdb;
  const ratingText = rating ? ` | ⭐ ${rating.toFixed(1)}` : '';

  return {
    title: `${title}${ratingText}`,
    description,
    openGraph: {
      title: `${title} | Ratingo`,
      description,
      url: `/show/${showId}`,
      type: 'video.tv_show',
      images: show.posterUrl ? [
        {
          url: show.posterUrl,
          width: 500,
          height: 750,
          alt: title,
        },
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title}${ratingText}`,
      description,
      images: show.posterUrl ? [show.posterUrl] : [],
    },
  };
}

export default async function ShowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const showId = parseInt(id, 10);

  if (isNaN(showId)) {
    notFound();
  }

  const show = await getShowDetails(showId);

  if (!show) {
    notFound();
  }

  return <ClientShowDetail show={show} />;
}
