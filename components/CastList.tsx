"use client";

import { useState } from "react";
import Image from "next/image";

type CastItem = {
  id: number;
  name: string;
  roles?: string[];
  profile_path?: string | null;
};

interface CastListProps {
  title?: string;
  cast: CastItem[];
  max?: number;
}

const IMG_BASE = "https://image.tmdb.org/t/p/w92";

export default function CastList({ title = "Актори", cast, max = 12 }: CastListProps) {
  const items = Array.isArray(cast) ? cast : [];
  const [expanded, setExpanded] = useState(false);
  const initialCount = Math.min(8, items.length);
  const visibleItems = expanded ? items.slice(0, max ?? items.length) : items.slice(0, initialCount);
  if (items.length === 0) return null;

  return (
    <div className="bg-zinc-900 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {visibleItems.map((person) => (
          <div key={person.id} className="flex items-center gap-2 bg-zinc-800/60 hover:bg-zinc-800 rounded-lg px-2 py-1">
            <div className="relative w-10 h-10 rounded-full overflow-hidden bg-zinc-700">
              {person.profile_path ? (
                <Image
                  src={`${IMG_BASE}${person.profile_path}`}
                  alt={person.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                  <span className="text-sm font-semibold text-zinc-300">{(person.name?.[0] || '·').toUpperCase()}</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold truncate max-w-[180px] flex items-center gap-2">
                <span className="truncate">{person.name}</span>
                {(person as any).imdbId && (
                  <a
                    href={`https://www.imdb.com/name/${(person as any).imdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >IMDb</a>
                )}
              </div>
              {person.roles && person.roles.length > 0 && (
                <div className="text-gray-400 text-xs truncate max-w-[180px]">
                  {person.roles[0]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {items.length > initialCount && (
        <button onClick={() => setExpanded(!expanded)} className="mt-3 text-sm text-blue-400 hover:text-blue-300">
          {expanded ? 'Згорнути' : 'Показати більше'}
        </button>
      )}
    </div>
  );
}
