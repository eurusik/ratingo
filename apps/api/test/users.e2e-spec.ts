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
  async listWithMedia(): Promise<any[]> {
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

describe('Users e2e', () => {
  let app: INestApplication;
  const authBase = '/api/auth';
  const usersBase = '/api/users';

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

    const registerRes = await request(app.getHttpServer())
      .post(`${authBase}/register`)
      .send({ email, username, password })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post(`${authBase}/login`)
      .send({ email, password })
      .expect(200);

    return { accessToken: loginRes.body.data.accessToken as string, email, username, password };
  };

  it('me: requires auth and returns user without password', async () => {
    await request(app.getHttpServer()).get(`${usersBase}/me`).expect(401);

    const { accessToken } = await registerAndLogin();

    const meRes = await request(app.getHttpServer())
      .get(`${usersBase}/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBeDefined();
    expect(meRes.body.data.passwordHash).toBeUndefined();
  });

  it('update profile: full payload updates and strips passwordHash', async () => {
    const { accessToken } = await registerAndLogin();

    const payload = {
      username: 'newname',
      avatarUrl: 'https://example.com/avatar.png',
      bio: 'Hello',
      location: 'Earth',
      website: 'https://example.com',
      preferredLanguage: 'en',
      preferredRegion: 'US',
      isProfilePublic: false,
      showWatchHistory: false,
      showRatings: false,
      allowFollowers: false,
    };

    const res = await request(app.getHttpServer())
      .patch(`${usersBase}/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('newname');
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.isProfilePublic).toBe(false);
  });

  it('update profile: partial payload does not overwrite unspecified fields', async () => {
    const { accessToken } = await registerAndLogin();

    // first set full profile
    await request(app.getHttpServer())
      .patch(`${usersBase}/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ bio: 'first', location: 'Kyiv', isProfilePublic: true })
      .expect(200);

    // partial update
    const res = await request(app.getHttpServer())
      .patch(`${usersBase}/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ location: 'Lviv' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.location).toBe('Lviv');
    expect(res.body.data.bio).toBe('first'); // not overwritten
  });

  it('update profile: validation fails on bad payload and 401 without auth', async () => {
    await request(app.getHttpServer())
      .patch(`${usersBase}/me`)
      .send({ website: 'not-a-url' })
      .expect(401);

    const { accessToken } = await registerAndLogin();

    await request(app.getHttpServer())
      .patch(`${usersBase}/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ username: 'ab', showRatings: 'yes' })
      .expect(400);
  });

  it('change password: happy path and old password stops working', async () => {
    const { accessToken, email, password } = await registerAndLogin();
    const newPassword = 'Anoth3rS3cure';

    await request(app.getHttpServer())
      .patch(`${usersBase}/me/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: password, newPassword })
      .expect(204);

    // old password should fail
    await request(app.getHttpServer())
      .post(`${authBase}/login`)
      .send({ email, password })
      .expect(401);

    // new password should work
    await request(app.getHttpServer())
      .post(`${authBase}/login`)
      .send({ email, password: newPassword })
      .expect(200);
  });

  it('change password: validation and 401 without auth', async () => {
    await request(app.getHttpServer())
      .patch(`${usersBase}/me/password`)
      .send({ currentPassword: 'a', newPassword: 'b' })
      .expect(401);

    const { accessToken } = await registerAndLogin();

    await request(app.getHttpServer())
      .patch(`${usersBase}/me/password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'short', newPassword: 'short' })
      .expect(400);
  });
});
