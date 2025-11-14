import React from "react";
import { ShowCard } from "@/components/ShowCard";
import type { ShowWithUrl } from "@/lib/types";

export function TrendingTop3({ shows, region }: { shows: ShowWithUrl[]; region?: string | null }) {
  if (!Array.isArray(shows) || shows.length < 3) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      <h2 className="text-2xl font-bold text-white mb-4">🏆 Топ‑3</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ShowCard show={shows[0]} rank={1} region={region || null} />
        <ShowCard show={shows[1]} rank={2} region={region || null} />
        <ShowCard show={shows[2]} rank={3} region={region || null} />
      </div>
    </div>
  );
}