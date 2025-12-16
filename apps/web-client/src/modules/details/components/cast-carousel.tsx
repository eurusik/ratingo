/**
 * Cast & Crew carousel
 * Horizontal scroll with actor photos and names
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Carousel } from '@/shared/components/carousel';

export interface CastMember {
  personId: string;
  slug: string;
  tmdbId: number;
  name: string;
  character: string;
  profilePath: string | null;
  order: number;
}

export interface CrewMember {
  personId: string;
  slug: string;
  tmdbId: number;
  name: string;
  job: string;
  department: string;
  profilePath: string | null;
}

export interface CastCarouselProps {
  cast: CastMember[];
  crew?: CrewMember[];
}

// Actor Avatar Component
function ActorAvatar({ actor }: { actor: CastMember }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const getProfileUrl = (path: string | null) => {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/w185${path}`;
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getColorFromName = (name: string) => {
    const colors = [
      'from-blue-400 via-blue-500 to-indigo-500',
      'from-blue-500 via-indigo-500 to-purple-500',
      'from-indigo-500 via-purple-500 to-pink-500',
      'from-purple-500 via-fuchsia-500 to-pink-500',
      'from-blue-400 via-purple-400 to-pink-400',
      'from-indigo-400 via-purple-400 to-fuchsia-500',
      'from-blue-500 via-purple-400 to-pink-400',
      'from-cyan-400 via-blue-500 to-purple-500',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const profileUrl = getProfileUrl(actor.profilePath);

  return (
    <div className="flex-shrink-0 w-20 space-y-2">
      {/* Photo */}
      <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-zinc-800 transition-colors opacity-90">
        {/* Avatar background - always visible */}
        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${getColorFromName(actor.name)}`}>
          <span className="text-2xl font-bold text-white">
            {getInitials(actor.name)}
          </span>
        </div>
        
        {/* Image overlay - only if loaded successfully */}
        {profileUrl && (
          <Image
            src={profileUrl}
            alt={actor.name}
            fill
            className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            sizes="80px"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(false)}
          />
        )}
      </div>

      {/* Name & Character */}
      <div className="text-center">
        <p className="text-xs font-medium text-zinc-200 line-clamp-1">
          {actor.name}
        </p>
        <p className="text-[10px] text-zinc-500 line-clamp-1">
          {actor.character}
        </p>
      </div>
    </div>
  );
}

export function CastCarousel({ cast, crew }: CastCarouselProps) {
  // Sort by order
  const sortedCast = cast.sort((a, b) => a.order - b.order);
  
  // Find director
  const director = crew?.find(c => c.job === 'Director');

  if (sortedCast.length === 0) return null;

  const subtitle = director 
    ? `Режисер: ${director.name}`
    : undefined;

  return (
    <Carousel 
      subtitle={subtitle}
      gap="lg"
    >
      {sortedCast.map((actor) => (
        <ActorAvatar key={actor.personId} actor={actor} />
      ))}
    </Carousel>
  );
}
