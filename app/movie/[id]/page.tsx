import { notFound } from 'next/navigation';
import { getMovieDetails } from '@/lib/queries/movies';
import { ClientMovieDetail } from './ClientMovieDetail';
import { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const movieId = parseInt(id, 10);

  if (isNaN(movieId)) {
    return {
      title: 'Фільм не знайдено',
    };
  }

  const movie = await getMovieDetails(movieId);

  if (!movie) {
    return {
      title: 'Фільм не знайдено',
    };
  }

  const title = movie.titleUk || movie.title;
  const description = (movie.overviewUk || movie.overview || 'Детальна інформація про фільм').slice(
    0,
    160
  );
  const rating = movie.primaryRating;
  const ratingText = rating ? ` ⭐ ${rating.toFixed(1)}` : '';
  const releaseYear = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : '';
  const yearText = releaseYear ? ` (${releaseYear})` : '';

  // Generate keywords
  const keywords = [
    title,
    movie.title !== title ? movie.title : '',
    'фільм онлайн',
    'дивитись фільм',
    'рейтинг фільму',
    'TMDB',
    'IMDb',
    releaseYear?.toString() || '',
  ].filter(Boolean) as string[];

  return {
    title: `${title}${yearText}${ratingText} | Ratingo`,
    description: `${title}${yearText} - ${description}. Рейтинги TMDB, IMDb, Trakt. Де дивитись легально онлайн.`,
    keywords,
    openGraph: {
      title: `${title}${yearText} | Ratingo`,
      description: `${description}. Рейтинги TMDB, IMDb, Trakt.`,
      url: `/movie/${movieId}`,
      type: 'video.movie',
      locale: 'uk_UA',
      siteName: 'Ratingo',
      images: movie.posterUrl
        ? [
            {
              url: movie.posterUrl,
              width: 500,
              height: 750,
              alt: `${title} постер`,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title}${yearText}${ratingText}`,
      description,
      images: movie.posterUrl ? [movie.posterUrl] : [],
    },
    alternates: {
      canonical: `/movie/${movieId}`,
    },
  };
}

export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = parseInt(id, 10);

  if (isNaN(movieId)) {
    notFound();
  }

  const movie = await getMovieDetails(movieId);

  if (!movie) {
    notFound();
  }

  return <ClientMovieDetail movie={movie} />;
}
