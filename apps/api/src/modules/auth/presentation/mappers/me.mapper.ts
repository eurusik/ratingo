import { type User } from '../../../users/domain/entities/user.entity';
import { type MeDto } from '../dto/me.dto';

/**
 * Stats shape returned by UserMediaService.getStats().
 */
interface UserStats {
  moviesRated: number;
  showsRated: number;
  watchlistCount: number;
}

/**
 * Maps domain User entity and stats to MeDto for the /auth/me endpoint.
 */
export class MeMapper {
  static toDto(user: User, stats: UserStats, linkedProviders: string[]): MeDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role as MeDto['role'],
      hasPassword: !!user.passwordHash,
      linkedProviders,
      profile: {
        bio: user.bio,
        location: user.location,
        website: user.website,
        preferredLanguage: user.preferredLanguage,
        preferredRegion: user.preferredRegion,
        privacy: {
          isProfilePublic: user.isProfilePublic,
          showWatchHistory: user.showWatchHistory,
          showRatings: user.showRatings,
          allowFollowers: user.allowFollowers,
          autoSubscribeOnWatch: user.autoSubscribeOnWatch,
        },
      },
      stats,
    };
  }
}
