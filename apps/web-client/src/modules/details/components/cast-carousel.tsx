/**
 * Cast & Crew carousel
 * Horizontal scroll with actor photos and names
 */

'use client';

import { Carousel } from '@/shared/components/carousel';
import { useTranslation } from '@/shared/i18n';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui';
import type { CastMember, CrewMember } from '../types';

export interface CastCarouselProps {
  cast: CastMember[];
  crew?: CrewMember[];
}

// Actor Avatar Component
function PersonAvatar({ 
  person, 
  role 
}: { 
  person: { name: string; profilePath: string | null }; 
  role: string;
}) {
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

  const profileUrl = getProfileUrl(person.profilePath);

  return (
    <div className="flex-shrink-0 w-20 space-y-2">
      {/* Photo */}
      <Avatar className="w-20 h-20 border-2 border-zinc-800 opacity-90">
        {profileUrl && <AvatarImage src={profileUrl} alt={person.name} />}
        <AvatarFallback className={`bg-gradient-to-br ${getColorFromName(person.name)} text-2xl font-bold text-white`}>
          {getInitials(person.name)}
        </AvatarFallback>
      </Avatar>

      {/* Name & Role */}
      <div className="text-center">
        <p className="text-xs font-medium text-zinc-200 line-clamp-1">
          {person.name}
        </p>
        <p className="text-[10px] text-zinc-500 line-clamp-1">
          {role}
        </p>
      </div>
    </div>
  );
}

export function CastCarousel({ cast, crew }: CastCarouselProps) {
  const { t } = useTranslation();
  
  // Sort by order
  const sortedCast = cast.sort((a, b) => a.order - b.order);

  if (sortedCast.length === 0) return null;

  return (
    <Carousel 
      title={t('details.cast.title')}
      titleTooltip={t('details.cast.tooltip')}
      gap="lg"
    >
      {sortedCast.map((actor) => (
        <PersonAvatar 
          key={actor.personId} 
          person={actor} 
          role={actor.character}
        />
      ))}
    </Carousel>
  );
}

// Crew Carousel Component
export function CrewCarousel({ crew }: { crew: CrewMember[] }) {
  const { t } = useTranslation();

  // Translate job titles
  const translateJob = (job: string): string => {
    const translations: Record<string, string> = {
      'Director': 'Режисер',
      'Creator': 'Креатор',
      'Executive Producer': 'Виконавчий продюсер',
      'Writer': 'Сценарист',
      'Screenplay': 'Сценарист',
    };
    return translations[job] || job;
  };

  // Filter important crew roles
  const importantCrew = crew.filter(c => 
    ['Director', 'Creator', 'Executive Producer', 'Writer', 'Screenplay'].includes(c.job)
  );

  // Prioritize: Creator → Director → Writer → Executive Producer
  const sortedCrew = importantCrew.sort((a, b) => {
    const priority: Record<string, number> = {
      'Creator': 1,
      'Director': 2,
      'Writer': 3,
      'Screenplay': 4,
      'Executive Producer': 5,
    };
    return (priority[a.job] || 99) - (priority[b.job] || 99);
  });

  if (sortedCrew.length === 0) return null;

  return (
    <Carousel 
      title={t('details.crew.title')}
      titleTooltip={t('details.crew.tooltip')}
      gap="lg"
    >
      {sortedCrew.map((member) => (
        <PersonAvatar 
          key={member.personId} 
          person={member} 
          role={translateJob(member.job)}
        />
      ))}
    </Carousel>
  );
}
