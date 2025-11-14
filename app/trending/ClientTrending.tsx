"use client";

import { useEffect, useState } from "react";
import type { ShowWithUrl } from "@/lib/types";
import type { AiringItem } from "@/lib/types";
import { AiringsList } from "@/components/AiringsList";
import { TrendingHero } from "@/components/TrendingHero";
import { TrendingTop3 } from "@/components/TrendingTop3";
import { TrendingAllSection } from "@/components/TrendingAllSection";
import { TrendingDeltaSection } from "@/components/TrendingDeltaSection";
import { useFilters } from "@/components/FiltersProvider";

// Use shared UI type instead of local interface

// AiringItem now imported from shared lib/types

export function ClientTrending({
  initialShows,
  initialAirings,
  initialGainers,
  initialLosers,
  initialWindowDays = 30,
  initialMetric = "delta",
  initialRegion = "US",
  initialCategory = null,
}: {
  initialShows: ShowWithUrl[];
  initialAirings: AiringItem[];
  initialGainers: ShowWithUrl[];
  initialLosers: ShowWithUrl[];
  initialWindowDays?: number;
  initialMetric?: "delta" | "delta3m";
  initialRegion?: string | null;
  initialCategory?: string | null;
}) {
  const [shows, setShows] = useState<ShowWithUrl[]>(initialShows || []);
  const [airings, setAirings] = useState<AiringItem[]>(initialAirings || []);
  const [gainers, setGainers] = useState<ShowWithUrl[]>(initialGainers || []);
  const [losers, setLosers] = useState<ShowWithUrl[]>(initialLosers || []);
  const [windowDays, setWindowDays] = useState<number>(initialWindowDays);
  const [metric, setMetric] = useState<"delta" | "delta3m">(initialMetric);
  const { region, category } = useFilters();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function refetch() {
      try {
        setLoading(true);
        setError(null);
        const regionQS = region ? `&region=${encodeURIComponent(region)}` : "";
        const categoryQS = category ? `&category=${encodeURIComponent(category)}` : "";
        const [showsRes, airingsRes, gainersRes, losersRes] = await Promise.all([
          fetch(`/api/shows?limit=50&sort=watchers&days=${windowDays}${regionQS}${categoryQS}`),
          fetch(`/api/airings?days=7${regionQS}${categoryQS}`),
          fetch(`/api/shows?limit=5&sort=${metric}&order=desc&days=${windowDays}${regionQS}${categoryQS}`),
          fetch(`/api/shows?limit=5&sort=${metric}&order=asc&days=${windowDays}${regionQS}${categoryQS}`),
        ]);
        if (showsRes.ok) {
          const sj = await showsRes.json();
          setShows((sj.shows || []) as ShowWithUrl[]);
        }
        if (airingsRes.ok) {
          const aj = await airingsRes.json();
          setAirings(Array.isArray(aj.airings) ? aj.airings : []);
        }
        let usedGainers: ShowWithUrl[] = [];
        let usedLosers: ShowWithUrl[] = [];
        if (gainersRes.ok) { const gj = await gainersRes.json(); usedGainers = (gj.shows || []) as ShowWithUrl[]; }
        if (losersRes.ok) { const lj = await losersRes.json(); usedLosers = (lj.shows || []) as ShowWithUrl[]; }
        setGainers(usedGainers);
        setLosers(usedLosers);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    }
    refetch();
  }, [windowDays, metric, region, category]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
      {shows.length > 0 && (<TrendingHero show={shows[0]} region={region||null} />)}

      {shows.length >= 3 && (<TrendingTop3 shows={shows.slice(0,3)} region={region||null} />)}

      {airings.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
          <AiringsList airings={airings} limit={3} actions={<a href="/airings" className="text-sm text-blue-400 hover:text-blue-300 mb-4">Переглянути всі →</a>} />
        </div>
      )}

      <TrendingDeltaSection
        gainers={gainers}
        losers={losers}
        windowDays={windowDays}
        metric={metric}
        onChangeWindowDays={setWindowDays}
        onChangeMetric={setMetric}
        region={region || null}
        category={category || null}
      />

      <TrendingAllSection shows={shows.slice(3)} region={region||null} />
    </div>
  );
}
