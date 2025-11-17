import React from 'react';
import { Card } from './Card';

interface Top3Props {
  items: any[];
  type: 'show' | 'movie';
  region?: string | null;
}

export function Top3({ items, type, region }: Top3Props) {
  if (!Array.isArray(items) || items.length < 3) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      <h2 className="text-2xl font-bold text-white mb-4">🏆 Топ‑3</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.slice(0, 3).map((item, index) => {
          const rank = index + 1;

          if (type === 'show') {
            return (
              <Card
                key={item.id}
                id={item.id}
                title={item.titleUk || item.title}
                posterUrl={item.posterUrl}
                rating={item.primaryRating || item.ratingTmdb}
                ratingImdb={item.ratingImdb}
                watchers={item.ratingTrakt}
                watchersDelta={item.watchersDelta}
                href={`/show/${item.id}${region ? `?region=${region}` : ''}`}
                type="show"
                rank={rank}
                trendingScore={item.trendingScore}
                nextEpisodeSeason={item.nextEpisodeSeason}
                nextEpisodeNumber={item.nextEpisodeNumber}
                nextEpisodeAirDate={item.nextEpisodeAirDate}
                latestSeasonEpisodes={item.latestSeasonEpisodes}
                lastEpisodeNumber={item.lastEpisodeNumber}
              />
            );
          } else {
            return (
              <Card
                key={item.id}
                id={item.id}
                title={item.titleUk || item.title}
                posterUrl={item.posterUrl}
                rating={item.primaryRating || item.ratingTmdb}
                ratingImdb={item.ratingImdb}
                watchers={item.ratingTrakt}
                watchersDelta={item.watchersDelta}
                releaseDate={item.releaseDate}
                href={`/movie/${item.id}${region ? `?region=${region}` : ''}`}
                type="movie"
                rank={rank}
                trendingScore={item.trendingScore}
              />
            );
          }
        })}
      </div>
    </div>
  );
}
