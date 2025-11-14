import { getShows, getAirings } from '@/lib/queries/shows';
import { ClientTrending } from './ClientTrending';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Тренди — Найпопулярніші серіали',
  description:
    "Перегляньте найпопулярніші серіали за рейтингами TMDB та Trakt. Злети і падіння тижня, топ-3 серіали та найближчі прем'єри.",
  openGraph: {
    title: 'Тренди — Найпопулярніші серіали | Ratingo',
    description: 'Перегляньте найпопулярніші серіали за рейтингами TMDB та Trakt',
    url: '/trending',
  },
};

export default async function TrendingPage({ searchParams }: { searchParams?: any }) {
  const windowDaysDefault = 30;
  let windowDays = windowDaysDefault;
  let metric: 'delta' | 'delta3m' = 'delta';
  const sp = await searchParams;
  const region = typeof sp?.region === 'string' ? sp.region : null;
  const provider = typeof sp?.provider === 'string' ? sp.provider : null;
  const category = typeof sp?.category === 'string' ? sp.category : null;

  // Initial fetch for SSR - direct DB queries
  let showsData = await getShows({
    limit: 20,
    sort: 'watchers',
    days: windowDays,
    region,
    provider,
    category,
  });
  const airingsData = await getAirings({ days: 7, region, provider, category });
  let gainersData = await getShows({
    limit: 5,
    sort: metric,
    order: 'desc',
    days: windowDays,
    region,
    provider,
    category,
  });
  let losersData = await getShows({
    limit: 5,
    sort: metric,
    order: 'asc',
    days: windowDays,
    region,
    provider,
    category,
  });

  // Fallback to 90d when 30d empty
  if (gainersData.length === 0 && losersData.length === 0) {
    windowDays = 90;
    showsData = await getShows({
      limit: 20,
      sort: 'watchers',
      days: windowDays,
      region,
      provider,
      category,
    });
    gainersData = await getShows({
      limit: 5,
      sort: metric,
      order: 'desc',
      days: windowDays,
      region,
      provider,
      category,
    });
    losersData = await getShows({
      limit: 5,
      sort: metric,
      order: 'asc',
      days: windowDays,
      region,
      provider,
      category,
    });
  }

  // Fallback to Δ 3міс when 90d + Δ empty
  if (
    windowDays === 90 &&
    metric === 'delta' &&
    gainersData.length === 0 &&
    losersData.length === 0
  ) {
    metric = 'delta3m';
    gainersData = await getShows({
      limit: 5,
      sort: metric,
      order: 'desc',
      days: windowDays,
      region,
      provider,
      category,
    });
    losersData = await getShows({
      limit: 5,
      sort: metric,
      order: 'asc',
      days: windowDays,
      region,
      provider,
      category,
    });
  }

  return (
    <ClientTrending
      initialShows={showsData || []}
      initialAirings={airingsData || []}
      initialGainers={gainersData || []}
      initialLosers={losersData || []}
      initialWindowDays={windowDays}
      initialMetric={metric}
      initialRegion={region}
      initialCategory={category}
    />
  );
}
