import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import authConfig from '../../src/config/auth.config';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { UsersModule } from '../../src/modules/users/users.module';
import { UserMediaModule } from '../../src/modules/user-media/user-media.module';
import { CatalogModule } from '../../src/modules/catalog/catalog.module';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import {
  USERS_REPOSITORY,
  IUsersRepository,
} from '../../src/modules/users/domain/repositories/users.repository.interface';
import {
  IRefreshTokensRepository,
  REFRESH_TOKENS_REPOSITORY,
} from '../../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { User } from '../../src/modules/users/domain/entities/user.entity';
import { RefreshToken } from '../../src/modules/auth/domain/entities/refresh-token.entity';
import { DATABASE_CONNECTION } from '../../src/database/database.module';
import {
  IUserMediaStateRepository,
  USER_MEDIA_STATE_REPOSITORY,
  UpsertUserMediaStateData,
} from '../../src/modules/user-media/domain/repositories/user-media-state.repository.interface';
import { UserMediaState } from '../../src/modules/user-media/domain/entities/user-media-state.entity';
import { MediaType } from '../../src/common/enums/media-type.enum';
import {
  IMovieRepository,
  MOVIE_REPOSITORY,
} from '../../src/modules/catalog/domain/repositories/movie.repository.interface';
import {
  IShowRepository,
  SHOW_REPOSITORY,
} from '../../src/modules/catalog/domain/repositories/show.repository.interface';
import { CatalogSearchService } from '../../src/modules/catalog/application/services/catalog-search.service';
import { SearchResponseDto } from '../../src/modules/catalog/presentation/dtos/search.dto';
import { MEDIA_REPOSITORY } from '../../src/modules/catalog/domain/repositories/media.repository.interface';
import { TmdbAdapter } from '../../src/modules/tmdb/tmdb.adapter';
import { FakeMovieRepository, FakeShowRepository } from './_fakes';

class InMemoryUsersRepository implements IUsersRepository {
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
  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
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
  async updateProfile(): Promise<User> {
    throw new Error('Not implemented');
  }
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const user = this.users.find((u) => u.id === id);
    if (user) user.passwordHash = passwordHash;
  }
}

class InMemoryRefreshTokensRepository implements IRefreshTokensRepository {
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
    this.tokens = this.tokens.filter((t) => t.userId !== userId);
  }
}

class InMemoryUserMediaRepository implements IUserMediaStateRepository {
  private states: Array<
    UserMediaState & {
      mediaSummary: {
        id: string;
        type: MediaType;
        title: string;
        slug: string;
        poster: null;
        backdrop: null;
      };
    }
  > = [];
  private makeSummary(mediaItemId: string) {
    return {
      id: mediaItemId,
      type: MediaType.MOVIE,
      title: `Title ${mediaItemId}`,
      slug: `slug-${mediaItemId}`,
      poster: null,
      backdrop: null,
    } as any;
  }
  async upsert(data: UpsertUserMediaStateData): Promise<UserMediaState> {
    const existing = this.states.find(
      (s) => s.userId === data.userId && s.mediaItemId === data.mediaItemId,
    );
    if (existing) {
      existing.state = data.state;
      existing.rating = data.rating ?? null;
      existing.progress = data.progress ?? null;
      existing.notes = data.notes ?? null;
      existing.updatedAt = new Date();
      return existing;
    }
    const created: UserMediaState & { mediaSummary: any } = {
      id: `state-${this.states.length + 1}`,
      userId: data.userId,
      mediaItemId: data.mediaItemId,
      state: data.state,
      rating: data.rating ?? null,
      progress: data.progress ?? null,
      notes: data.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      mediaSummary: this.makeSummary(data.mediaItemId),
    } as any;
    this.states.push(created);
    return created;
  }
  async findOne(userId: string, mediaItemId: string): Promise<UserMediaState | null> {
    return this.states.find((s) => s.userId === userId && s.mediaItemId === mediaItemId) ?? null;
  }
  async listByUser(userId: string, limit = 20, offset = 0): Promise<UserMediaState[]> {
    return this.states.filter((s) => s.userId === userId).slice(offset, offset + limit);
  }
  async findManyByMediaIds(userId: string, mediaItemIds: string[]): Promise<UserMediaState[]> {
    return this.states.filter((s) => s.userId === userId && mediaItemIds.includes(s.mediaItemId));
  }
  async listWithMedia(userId: string, limit = 20, offset = 0, options?: any) {
    let items = this.states.filter((s) => s.userId === userId);
    if (options?.ratedOnly) items = items.filter((s) => s.rating !== null);
    if (options?.states?.length) items = items.filter((s) => options.states.includes(s.state));
    return items.slice(offset, offset + limit);
  }

  async countWithMedia(userId: string, options?: any): Promise<number> {
    let items = this.states.filter((s) => s.userId === userId);
    if (options?.ratedOnly) items = items.filter((s) => s.rating !== null);
    if (options?.states?.length) items = items.filter((s) => options.states.includes(s.state));
    return items.length;
  }

  async listActivityWithMedia(userId: string, limit = 20, offset = 0): Promise<any[]> {
    let items = this.states.filter((s) => s.userId === userId);
    items = items.filter((s) => s.state === 'watching' || s.progress !== null);
    items = [...items].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return items.slice(offset, offset + limit);
  }

  async listContinueWithMedia(userId: string, limit = 20, offset = 0): Promise<any[]> {
    let items = this.states.filter((s) => s.userId === userId);
    items = items.filter((s) => s.progress !== null);
    items = [...items].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return items.slice(offset, offset + limit);
  }

  async countActivityWithMedia(userId: string): Promise<number> {
    return this.states.filter(
      (s) => s.userId === userId && (s.state === 'watching' || s.progress !== null),
    ).length;
  }

  async countContinueWithMedia(userId: string): Promise<number> {
    return this.states.filter((s) => s.userId === userId && s.progress !== null).length;
  }
  async getStats(userId: string) {
    const byUser = this.states.filter((s) => s.userId === userId);
    const rated = byUser.filter((s) => s.rating !== null);
    return {
      moviesRated: rated.filter((s) => s.mediaSummary.type === MediaType.MOVIE).length,
      showsRated: rated.filter((s) => s.mediaSummary.type === MediaType.SHOW).length,
      watchlistCount: byUser.filter((s) => s.state === 'planned').length,
    };
  }
  async findOneWithMedia(userId: string, mediaItemId: string) {
    return this.states.find((s) => s.userId === userId && s.mediaItemId === mediaItemId) ?? null;
  }
}

class FakeMediaRepository {
  async upsertStub(): Promise<{ id: string; slug: string }> {
    return { id: 'mid-stub', slug: 'stub' };
  }
  async upsert(): Promise<void> {
    return;
  }
  async findByTmdbId(): Promise<any | null> {
    return null;
  }
  async updateIngestionStatus(): Promise<void> {
    return;
  }
  async findByIdForScoring(): Promise<any | null> {
    return null;
  }
  async findManyByTmdbIds(): Promise<any[]> {
    return [];
  }
  async findManyForScoring(): Promise<any[]> {
    return [];
  }
  async findHero(): Promise<any[]> {
    return [];
  }
  async search(): Promise<any[]> {
    return [];
  }
}

class FakeCatalogSearchService {
  async search(query: string): Promise<SearchResponseDto> {
    if (!query || query.length < 2) return { query, local: [], tmdb: [] };
    return {
      query,
      local: [
        {
          source: 'local' as any,
          type: MediaType.MOVIE,
          id: 'mid-1',
          slug: 'movie-one',
          tmdbId: 1,
          title: 'Movie One',
          originalTitle: null,
          year: 2024,
          poster: null,
          rating: 7,
          isImported: true,
        },
      ],
      tmdb: [],
    };
  }
}

export interface CatalogE2eContext {
  app: INestApplication;
  moviesRepo: FakeMovieRepository;
  showsRepo: FakeShowRepository;
  registerAndLogin: () => Promise<string>;
  setUserState: (token: string, mediaItemId: string) => Promise<void>;
  get: (path: string, token?: string) => any;
  close: () => Promise<void>;
}

export async function createCatalogApp(): Promise<CatalogE2eContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [authConfig], ignoreEnvFile: true }),
      AuthModule,
      UsersModule,
      UserMediaModule,
      CatalogModule,
    ],
  })
    .overrideProvider(USERS_REPOSITORY)
    .useClass(InMemoryUsersRepository)
    .overrideProvider(REFRESH_TOKENS_REPOSITORY)
    .useClass(InMemoryRefreshTokensRepository)
    .overrideProvider(USER_MEDIA_STATE_REPOSITORY)
    .useClass(InMemoryUserMediaRepository)
    .overrideProvider(DATABASE_CONNECTION)
    .useValue({})
    .overrideProvider(MOVIE_REPOSITORY)
    .useClass(FakeMovieRepository)
    .overrideProvider(SHOW_REPOSITORY)
    .useClass(FakeShowRepository)
    .overrideProvider(MEDIA_REPOSITORY)
    .useClass(FakeMediaRepository)
    .overrideProvider(TmdbAdapter)
    .useValue({ searchMulti: () => [] })
    .overrideProvider(CatalogSearchService)
    .useClass(FakeCatalogSearchService)
    .compile();

  const moviesRepo = moduleFixture.get(MOVIE_REPOSITORY) as unknown as FakeMovieRepository;
  const showsRepo = moduleFixture.get(SHOW_REPOSITORY) as unknown as FakeShowRepository;

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();

  const authBase = '/api/auth';
  const catalogBase = '/api/catalog';

  const registerAndLogin = async () => {
    const email = `cat${Date.now()}@example.com`;
    const username = `cat${Date.now()}`;
    const password = 'S3curePassw0rd';
    const reg = await request(app.getHttpServer())
      .post(`${authBase}/register`)
      .send({ email, username, password })
      .expect(201);
    return reg.body.data.accessToken as string;
  };

  const setUserState = async (token: string, mediaItemId: string) => {
    await request(app.getHttpServer())
      .patch(`/api/user-media/${mediaItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: 'watching', rating: 8 })
      .expect(200);
  };

  const get = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  return {
    app,
    moviesRepo,
    showsRepo,
    registerAndLogin,
    setUserState,
    get,
    close: () => app.close(),
  };
}
