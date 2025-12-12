import { User, USER_ROLE } from '../domain/entities/user.entity';

export type ViewerContext =
  | {
      id?: User['id'] | null;
      role?: User['role'] | null;
    }
  | null
  | undefined;

export class UserProfileVisibilityPolicy {
  private static readonly ADMIN_ROLE: User['role'] = USER_ROLE.ADMIN;

  static isOwnerOrAdmin(owner: User, viewer?: ViewerContext | null): boolean {
    if (!viewer) return false;
    if (viewer.role === this.ADMIN_ROLE) return true;
    if (viewer.id === owner.id) return true;
    return false;
  }

  static canViewProfile(owner: User, viewer?: ViewerContext | null): boolean {
    if (owner.isProfilePublic) return true;
    return this.isOwnerOrAdmin(owner, viewer);
  }

  static canViewRatings(owner: User, viewer?: ViewerContext | null): boolean {
    if (this.isOwnerOrAdmin(owner, viewer)) return true;
    return owner.isProfilePublic && owner.showRatings;
  }

  static canViewWatchHistory(owner: User, viewer?: ViewerContext | null): boolean {
    if (this.isOwnerOrAdmin(owner, viewer)) return true;
    return owner.isProfilePublic && owner.showWatchHistory;
  }
}
