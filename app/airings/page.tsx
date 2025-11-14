import { getAirings } from '@/lib/queries/shows';
import { ClientAirings } from './ClientAirings';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Надходження — Найближчі епізоди серіалів",
  description: "Розклад виходу нових епізодів трендових серіалів. Не пропустіть прем'єри ваших улюблених шоу на найближчі 7-30 днів.",
  openGraph: {
    title: "Надходження — Найближчі епізоди | Ratingo",
    description: "Розклад виходу нових епізодів трендових серіалів",
    url: "/airings",
  },
};

export default async function AiringsPage({ searchParams }: { searchParams?: any }) {
  const sp = await searchParams;
  const initialDays = Math.max(1, Math.min(30, parseInt(typeof sp?.days === 'string' ? sp.days : '7', 10)));
  const region = typeof sp?.region === 'string' ? sp.region : null;
  const provider = typeof sp?.provider === 'string' ? sp.provider : null;
  const category = typeof sp?.category === 'string' ? sp.category : null;
  const airings = await getAirings({ days: initialDays, region, provider, category });

  return <ClientAirings initialAirings={airings || []} initialDays={initialDays} initialRegion={region} initialCategory={category} />;
}
