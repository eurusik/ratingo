import { Metadata } from 'next';
import { db } from '@/db';
import { featureRequests, FeatureRequest } from '@/db/schema';
import { desc } from 'drizzle-orm';
import IdeasClient from './IdeasClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ідеї розвитку — Запити фіч',
  description:
    'Голосуйте за фічі, які хочете бачити, та створюйте нові запити. Ідеї розвитку Ratingo.',
  openGraph: {
    title: 'Ідеї розвитку — Ratingo',
    description: 'Голосуйте за фічі, які хочете бачити, та створюйте нові запити.',
    url: '/ideas',
  },
};

export default async function RoadmapPage() {
  let items: FeatureRequest[] = [];
  try {
    items = await db
      .select()
      .from(featureRequests)
      .orderBy(desc(featureRequests.votes), desc(featureRequests.createdAt));
  } catch {
    items = [];
  }

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Ідеї розвитку</h1>
      </div>
      <IdeasClient initialItems={items} />
    </section>
  );
}
