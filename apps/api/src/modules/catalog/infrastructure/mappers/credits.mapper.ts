import { Credits, CastMember, CrewMember } from '../../../../database/schema';
import { CreditsDto, CastMemberDto, CrewMemberDto } from '../../presentation/dtos/common.dto';

export class CreditsMapper {
  static toDto(credits: Credits | null): CreditsDto | null {
    if (!credits) return null;

    return {
      cast: (credits.cast || []).map(this.mapCastMember),
      crew: (credits.crew || []).map(this.mapCrewMember),
    };
  }

  private static mapCastMember(member: CastMember): CastMemberDto {
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

  private static mapCrewMember(member: CrewMember): CrewMemberDto {
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
