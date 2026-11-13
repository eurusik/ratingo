import type { MovieDetails } from '@/shared/api';
import { tmdbPosterUrl } from '@/shared/config';

type CreditsDto = NonNullable<MovieDetails['credits']>;
type CrewMember = CreditsDto['crew'][number];

export interface CastMember {
  id: string;
  name: string;
  character?: string;
  photoUrl?: string;
}

export interface Credits {
  cast: CastMember[];
  directors: string[];
  writers: string[];
  creators: string[];
}

const CAST_LIMIT = 15;
const CREW_NAMES_LIMIT = 3;
const DIRECTOR_JOBS = new Set(['Director']);
const WRITER_JOBS = new Set(['Screenplay', 'Writer', 'Story', 'Novel']);
const CREATOR_JOBS = new Set(['Creator']);

function namesWithJob(crew: CrewMember[], jobs: Set<string>): string[] {
  const names = crew.filter((member) => jobs.has(member.job)).map((member) => member.name);
  return [...new Set(names)].slice(0, CREW_NAMES_LIMIT);
}

export function toCredits(credits: MovieDetails['credits']): Credits {
  const cast = [...(credits?.cast ?? [])]
    .sort((left, right) => left.order - right.order)
    .slice(0, CAST_LIMIT)
    .map((member) => ({
      id: member.personId,
      name: member.name,
      character: member.character.trim() || undefined,
      photoUrl: tmdbPosterUrl(member.profilePath, 'w154'),
    }));
  const crew = credits?.crew ?? [];

  return {
    cast,
    directors: namesWithJob(crew, DIRECTOR_JOBS),
    writers: namesWithJob(crew, WRITER_JOBS),
    creators: namesWithJob(crew, CREATOR_JOBS),
  };
}

export function hasCredits(credits: Credits): boolean {
  return [credits.cast, credits.directors, credits.writers, credits.creators].some(
    (group) => group.length > 0,
  );
}
