import React from 'react';
import type { AiringItem } from '@/lib/types';

interface AiringsListProps {
  airings: AiringItem[];
  limit?: number;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}

export function AiringsList({ airings, limit = 12, className, title = 'Що виходить цього тижня', actions }: AiringsListProps) {
  if (!Array.isArray(airings) || airings.length === 0) return null;
  const items = airings.slice(0, limit);
  const showHeader = Boolean(title) || Boolean(actions);

  return (
    <div className={className ?? ''}>
      {showHeader && (
        <div className="flex items-center justify-between">
          {title && <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="space-y-3">
        {items.map((a) => (
          <div key={`${a.tmdbId}-${a.season}-${a.episode}-${a.airDate}`} className="flex items-center justify-between bg-zinc-900 rounded-lg px-4 py-3">
            <a href={a.show?.id ? `/show/${a.show.id}` : undefined} className="flex items-center space-x-3 hover:opacity-90">
              {a.show?.poster && (
                <img src={`https://image.tmdb.org/t/p/w92${a.show.poster}`} alt={a.show?.title || 'poster'} className="w-10 h-10 rounded" />
              )}
              <div>
                <div className="text-white font-medium">
                  {a.show?.title || a.title || 'Невідомий серіал'}
                </div>
                <div className="text-gray-400 text-xs">
                  {a.season != null && a.episode != null ? `S${a.season}E${a.episode}` : ''}
                  {a.episodeTitle ? ` · ${a.episodeTitle}` : ''}
                  {a.network ? ` · ${a.network}` : ''}
                </div>
              </div>
            </a>
            <div className="text-gray-300 text-sm">
              {a.airDate ? new Date(a.airDate).toLocaleDateString('uk-UA', { year: 'numeric', month: '2-digit', day: '2-digit' }) : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
