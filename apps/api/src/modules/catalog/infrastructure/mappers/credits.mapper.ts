import type {
  Credits,
  CastMember as TmdbCastMember,
  CrewMember as TmdbCrewMember,
} from '../../../ingestion/public';
import type { CreditsData, CastMember, CrewMember } from '../../domain/types/common.types';

export class CreditsMapper {
  static toDto(credits: Credits | null): CreditsData | null {
    if (!credits) return null;

    return {
      cast: (credits.cast || []).map(this.mapCastMember),
      crew: (credits.crew || []).map(this.mapCrewMember),
    };
  }

  private static mapCastMember(member: TmdbCastMember): CastMember {
    return {
      tmdbId: member.tmdbId,
      personId: `tmdb:${member.tmdbId}`,
      slug: CreditsMapper.generateSlug(member.name),
      name: member.name,
      character: member.character,
      profilePath: member.profilePath,
      order: member.order,
    };
  }

  private static mapCrewMember(member: TmdbCrewMember): CrewMember {
    return {
      tmdbId: member.tmdbId,
      personId: `tmdb:${member.tmdbId}`,
      slug: CreditsMapper.generateSlug(member.name),
      name: member.name,
      job: member.job,
      department: member.department,
      profilePath: member.profilePath,
    };
  }

  private static generateSlug(name: string): string | null {
    const slug = name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .trim()
      .replace(/\s+/g, '-'); // Replace spaces with hyphens

    return slug.length > 0 ? slug : null;
  }
}
