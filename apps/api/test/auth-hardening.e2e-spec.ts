import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import authConfig from '../src/config/auth.config';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  USERS_REPOSITORY,
  IUsersRepository,
} from '../src/modules/users/domain/repositories/users.repository.interface';
import {
  IRefreshTokensRepository,
  REFRESH_TOKENS_REPOSITORY,
} from '../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { User } from '../src/modules/users/domain/entities/user.entity';
import { RefreshToken } from '../src/modules/auth/domain/entities/refresh-token.entity';
import { DATABASE_CONNECTION } from '../src/database/database.module';
import {
  IUserMediaStateRepository,
  USER_MEDIA_STATE_REPOSITORY,
} from '../src/modules/user-media/domain/repositories/user-media-state.repository.interface';

type UserData = Omit<User, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

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

  async updateProfile(): Promise<User> {
    throw new Error('Not implemented');
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const user = this.users.find((u) => u.id === id);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }
}

class InMemoryUserMediaRepository implements IUserMediaStateRepository {
  async upsert(): Promise<any> {
    throw new Error('Not implemented');
  }
  async findOne(): Promise<any> {
    return null;
  }
  async listByUser(): Promise<any[]> {
    return [];
  }
  async findManyByMediaIds(): Promise<any[]> {
    return [];
  }
  async getStats(): Promise<{ moviesRated: number; showsRated: number; watchlistCount: number }> {
    return { moviesRated: 0, showsRated: 0, watchlistCount: 0 };
  }
  async listWithMedia(
    _userId?: string,
    _limit?: number,
    _offset?: number,
    _options?: any,
  ): Promise<any[]> {
    return [];
  }
  async findOneWithMedia(): Promise<any> {
    return null;
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
    this.tokens.forEach((t) => {
      if (t.userId === userId) t.revokedAt = new Date();
    });
  }
}

describe('Auth hardening e2e', () => {
  let app: INestApplication;
  const baseUrl = '/api/auth';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [authConfig], ignoreEnvFile: true }),
        AuthModule,
        UsersModule,
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
      .compile();

    app = moduleFixture.createNestApplication();
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
  });

  afterAll(async () => {
    await app.close();
  });

  const registerAndLogin = async () => {
    const email = `user${Date.now()}@example.com`;
    const username = `user${Date.now()}`;
    const password = 'S3curePassw0rd';

    await request(app.getHttpServer())
      .post(`${baseUrl}/register`)
      .send({ email, username, password })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post(`${baseUrl}/login`)
      .send({ email, password })
      .expect(200);

    return {
      email,
      password,
      accessToken: loginRes.body.data.accessToken as string,
      refreshToken: loginRes.body.data.refreshToken as string,
    };
  };

  it('/auth/me requires bearer and returns profile', async () => {
    await request(app.getHttpServer()).get(`${baseUrl}/me`).expect(401);

    const { accessToken } = await registerAndLogin();

    const meRes = await request(app.getHttpServer())
      .get(`${baseUrl}/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBeDefined();
  });

  it('refresh rotation: old refresh token becomes invalid after rotation', async () => {
    const { refreshToken } = await registerAndLogin();

    const firstRefresh = await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken })
      .expect(201);

    const newRefresh = firstRefresh.body.data.refreshToken as string;

    // old token reuse should be rejected
    await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken })
      .expect(401);

    // new token still works (rotation chain)
    const secondRefresh = await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken: newRefresh })
      .expect(201);
    expect(secondRefresh.body.data.accessToken).toBeDefined();
  });

  it('reusing a revoked refresh token is rejected, rotated token remains valid', async () => {
    const { refreshToken } = await registerAndLogin();

    const firstRefresh = await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken })
      .expect(201);

    const rotated = firstRefresh.body.data.refreshToken as string;

    // reuse old (already revoked) token -> 401
    await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken })
      .expect(401);

    // rotated token still valid
    await request(app.getHttpServer())
      .post(`${baseUrl}/refresh`)
      .send({ refreshToken: rotated })
      .expect(201);
  });
});
