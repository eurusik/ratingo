import React from "react";
import { ShowCard } from "@/components/ShowCard";
import type { ShowWithUrl } from "@/lib/types";

export function TrendingAllSection({ shows, region }: { shows: ShowWithUrl[]; region?: string | null }) {
  if (!Array.isArray(shows) || shows.length === 0) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Усі трендові серіали</h2>
        <p className="text-gray-400">Відкрий найпопулярніші серіали прямо зараз на основі рейтингів TMDB і Trakt</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
        {shows.map((show) => (
          <ShowCard key={show.id} show={show} region={region || null} />
        ))}
      </div>
    </div>
  );
}