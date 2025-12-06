'use client';

import { useEffect, useState } from 'react';
import { AiringsList } from '@/components/AiringsList';
import { AiringsDaysSelector } from '@/components/AiringsDaysSelector';
import { AiringsSkeleton } from '@/components/AiringsSkeleton';
import { useFilters } from '@/components/FiltersProvider';
import type { AiringItem } from '@/lib/types';

export function ClientAirings({
  initialAirings,
  initialDays = 7,
  initialRegion,
  initialCategory,
}: {
  initialAirings: AiringItem[];
  initialDays?: number;
  initialRegion?: string | null;
  initialCategory?: string | null;
}) {
  const [airings, setAirings] = useState<AiringItem[]>(initialAirings || []);
  const [days, setDays] = useState(initialDays);
  const { region, category } = useFilters();
  const [loading, setLoading] = useState(false);

  async function handleDaysChange(newDays: number) {
    setDays(newDays);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ days: String(newDays) });
      if (region) qs.set('region', region);
      if (category) qs.set('category', category);
      const res = await fetch(`/api/airings?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAirings(Array.isArray(data.airings) ? (data.airings as AiringItem[]) : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Refetch when global filters change
    handleDaysChange(days);
  }, [region, category]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold text-white">Надходження</h1>
          <AiringsDaysSelector days={days} onChange={handleDaysChange} disabled={loading} />
        </div>
        {loading ? (
          <AiringsSkeleton rows={6} />
        ) : (
          <AiringsList airings={airings} title="" limit={100} />
        )}
      </div>
    </div>
  );
}
