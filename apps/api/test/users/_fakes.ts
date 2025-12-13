import { IUsersRepository } from '../../src/modules/users/domain/repositories/users.repository.interface';
import { User } from '../../src/modules/users/domain/entities/user.entity';
import { IRefreshTokensRepository } from '../../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { RefreshToken } from '../../src/modules/auth/domain/entities/refresh-token.entity';
import { IUserMediaStateRepository } from '../../src/modules/user-media/domain/repositories/user-media-state.repository.interface';

export type UserData = Omit<User, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export class InMemoryUsersRepository implements IUsersRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.users.find((u) => u.username === username) ?? null;
  }

  async create(data: UserData): Promise<User> {
    const user: User = {
      ...data,
      id: `user-${this.users.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: data.passwordHash,
      avatarUrl: data.avatarUrl ?? null,
      bio: data.bio ?? null,
      location: data.location ?? null,
      website: data.website ?? null,
      preferredLanguage: data.preferredLanguage ?? null,
      preferredRegion: data.preferredRegion ?? null,
      isProfilePublic: data.isProfilePublic ?? true,
      showWatchHistory: data.showWatchHistory ?? true,
      showRatings: data.showRatings ?? true,
      allowFollowers: data.allowFollowers ?? true,
      role: (data.role as User['role']) ?? 'user',
    } as User;
    this.users.push(user);
    return user;
  }

  async updateProfile(id: string, payload: Partial<UserData>): Promise<User> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) {
        (user as any)[key] = value;
      }
    });
    user.updatedAt = new Date();
    return user;
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }
}

export class InMemoryUserMediaRepository implements IUserMediaStateRepository {
  private states: any[] = [];

  addState(state: any) {
    this.states.push(state);
  }

  clear() {
    this.states = [];
  }

  private makeSummary(mediaItemId: string) {
    return {
      id: mediaItemId,
      type: 'movie',
      title: `Title ${mediaItemId}`,
      slug: `slug-${mediaItemId}`,
      poster: null,
      releaseDate: new Date('2020-01-01'),
    };
  }

  async upsert(data: any): Promise<any> {
    const existing = this.states.find(
      (s) => s.userId === data.userId && s.mediaItemId === data.mediaItemId,
    );
    if (existing) {
      Object.assign(existing, {
        state: data.state,
        rating: data.rating ?? null,
        progress: data.progress ?? null,
        notes: data.notes ?? null,
        updatedAt: data.updatedAt ?? new Date(),
      });
      if (data.releaseDate !== undefined) {
        existing.mediaSummary = {
          ...existing.mediaSummary,
          releaseDate: data.releaseDate,
        };
      }
      return existing;
    }
    const now = new Date();
    const created = {
      id: `state-${this.states.length + 1}`,
      userId: data.userId,
      mediaItemId: data.mediaItemId,
      state: data.state,
      rating: data.rating ?? null,
      progress: data.progress ?? null,
      notes: data.notes ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
      mediaSummary: {
        ...this.makeSummary(data.mediaItemId),
        releaseDate:
          data.releaseDate !== undefined
            ? data.releaseDate
            : this.makeSummary(data.mediaItemId).releaseDate,
      },
    };
    this.states.push(created);
    return created;
  }

  async findOne(userId: string, mediaItemId: string): Promise<any> {
    return this.states.find((s) => s.userId === userId && s.mediaItemId === mediaItemId) ?? null;
  }

  async listByUser(userId: string, limit = 20, offset = 0): Promise<any[]> {
    return this.states.filter((s) => s.userId === userId).slice(offset, offset + limit);
  }

  async findManyByMediaIds(userId: string, mediaItemIds: string[]): Promise<any[]> {
    return this.states.filter((s) => s.userId === userId && mediaItemIds.includes(s.mediaItemId));
  }

  async getStats(): Promise<{ moviesRated: number; showsRated: number; watchlistCount: number }> {
    return { moviesRated: 0, showsRated: 0, watchlistCount: 0 };
  }

  async listWithMedia(
    userId: string,
    limit = 20,
    offset = 0,
    options?: { ratedOnly?: boolean; states?: string[]; sort?: string },
  ): Promise<any[]> {
    let items = this.states.filter((s) => s.userId === userId);

    if (options?.ratedOnly) {
      items = items.filter((s) => s.rating !== null);
    }
    if (options?.states?.length) {
      items = items.filter((s) => options.states.includes(s.state));
    }

    switch (options?.sort) {
      case 'rating':
        items = [...items].sort(
          (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.updatedAt - a.updatedAt,
        );
        break;
      case 'releaseDate':
        items = [...items].sort(
          (a, b) =>
            (b.mediaSummary.releaseDate?.getTime() ?? 0) -
              (a.mediaSummary.releaseDate?.getTime() ?? 0) || b.updatedAt - a.updatedAt,
        );
        break;
      case 'recent':
      default:
        items = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return items.slice(offset, offset + limit);
  }

  async findOneWithMedia(userId: string, mediaItemId: string): Promise<any> {
    return this.states.find((s) => s.userId === userId && s.mediaItemId === mediaItemId) ?? null;
  }
}

export class InMemoryRefreshTokensRepository implements IRefreshTokensRepository {
  private tokens: RefreshToken[] = [];

  async issue(token: Omit<RefreshToken, 'createdAt'>): Promise<RefreshToken> {
    const issued: RefreshToken = { ...token, createdAt: new Date() } as RefreshToken;
    this.tokens.push(issued);
    return issued;
  }

  async findById(id: string): Promise<RefreshToken | null> {
    return this.tokens.find((t) => t.id === id) ?? null;
  }

  async findValidByUser(userId: string): Promise<RefreshToken[]> {
    const now = new Date();
    return this.tokens.filter((t) => t.userId === userId && !t.revokedAt && t.expiresAt >= now);
  }

  async revoke(id: string): Promise<void> {
    const token = this.tokens.find((t) => t.id === id);
    if (token) token.revokedAt = new Date();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    this.tokens.forEach((t) => {
      if (t.userId === userId) t.revokedAt = new Date();
    });
  }
}
