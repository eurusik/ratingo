import { Metadata } from 'next';
import ClientMovies from './ClientMovies';

export const metadata: Metadata = {
  title: 'Трендові фільми 2024-2025 | Рейтинги TMDB, IMDb | Ratingo',
  description:
    'Найпопулярніші та трендові фільми 2024-2025 року з рейтингами TMDB, Trakt, IMDb. Дізнайтесь де дивитись фільми легально онлайн в Україні, США та світі.',
  keywords: [
    'трендові фільми',
    'популярні фільми 2024',
    'рейтинг фільмів',
    'TMDB',
    'IMDb',
    'Trakt',
    'де дивитись фільми онлайн',
    'кращі фільми',
  ],
  openGraph: {
    title: 'Трендові фільми 2024-2025 | Рейтинги TMDB, IMDb | Ratingo',
    description:
      'Найпопулярніші та трендові фільми з рейтингами TMDB, Trakt, IMDb. Де дивитись легально онлайн.',
    url: '/movies',
    type: 'website',
    locale: 'uk_UA',
    siteName: 'Ratingo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Трендові фільми 2024-2025 | Ratingo',
    description: 'Найпопулярніші фільми з рейтингами TMDB, Trakt, IMDb',
  },
  alternates: {
    canonical: '/movies',
  },
};

async function getMovies(region: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const res = await fetch(
    `${baseUrl}/api/movies?region=${region}&limit=50&sort=watchers&order=desc`,
    {
      next: { revalidate: 30 },
    }
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.movies || [];
}

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const params = await searchParams;
  const region = params.region || 'US';
  const movies = await getMovies(region);

  return <ClientMovies initialMovies={movies} region={region} />;
}
