'use client';

import { useState, useEffect } from 'react';
import { Hero } from '@/components/Hero';
import { CardGrid } from '@/components/CardGrid';
import { Card } from '@/components/Card';
import { Top3 } from '@/components/Top3';

interface Movie {
  id: number;
  tmdbId: number;
  title: string;
  titleUk?: string | null;
  overview?: string | null;
  overviewUk?: string | null;
  posterUrl: string | null;
  primaryRating?: number | null;
  ratingTrakt?: number | null;
  ratingImdb?: number | null;
  watchersDelta?: number | null;
  releaseDate?: string | null;
  trendingScore?: number | null;
}

export default function ClientMovies({
  initialMovies,
  region,
}: {
  initialMovies: Movie[];
  region: string;
}) {
  const [movies] = useState<Movie[]>(initialMovies);

  const heroMovie = movies[0];

  return (
    <div className="min-h-screen bg-zinc-950" suppressHydrationWarning>
      {/* Hero Section */}
      {heroMovie && (
        <Hero
          title={heroMovie.titleUk || heroMovie.title}
          overview={heroMovie.overviewUk || heroMovie.overview}
          posterUrl={heroMovie.posterUrl}
          rating={heroMovie.primaryRating}
          watchers={heroMovie.ratingTrakt}
          badge="🔥 №1 у трендах зараз"
          href={`/movie/${heroMovie.id}?region=${region}`}
        />
      )}

      {/* Top 3 Section */}
      {movies.length >= 3 && <Top3 items={movies.slice(0, 3)} type="movie" region={region} />}

      {/* Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Усі трендові фільми</h2>
          <p className="text-gray-400">
            Відкрий найпопулярніші фільми прямо зараз на основі рейтингів TMDB і Trakt
          </p>
        </div>
        {/* Trending Movies Grid */}
        <CardGrid>
          {movies.slice(3).map((movie, index) => (
            <Card
              key={movie.id}
              id={movie.id}
              title={movie.titleUk || movie.title}
              posterUrl={movie.posterUrl}
              rating={movie.primaryRating}
              ratingImdb={movie.ratingImdb}
              watchers={movie.ratingTrakt}
              watchersDelta={movie.watchersDelta}
              releaseDate={movie.releaseDate}
              href={`/movie/${movie.id}?region=${region}`}
              type="movie"
              trendingScore={movie.trendingScore}
            />
          ))}
        </CardGrid>
      </div>
    </div>
  );
}
