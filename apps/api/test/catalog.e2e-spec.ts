import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import authConfig from '../src/config/auth.config';
import { AuthModule } from '../src/modules/auth/auth.module';
import { UsersModule } from '../src/modules/users/users.module';
import { UserMediaModule } from '../src/modules/user-media/user-media.module';
import { CatalogModule } from '../src/modules/catalog/catalog.module';
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
  UpsertUserMediaStateData,
} from '../src/modules/user-media/domain/repositories/user-media-state.repository.interface';
import { UserMediaState } from '../src/modules/user-media/domain/entities/user-media-state.entity';
import { MediaType } from '../src/common/enums/media-type.enum';
import {
  IMovieRepository,
  MOVIE_REPOSITORY,
  MovieWithMedia,
  NowPlayingOptions,
} from '../src/modules/catalog/domain/repositories/movie.repository.interface';
import {
  IShowRepository,
  SHOW_REPOSITORY,
  TrendingShowsOptions,
  CalendarEpisode,
} from '../src/modules/catalog/domain/repositories/show.repository.interface';
import { CatalogSearchService } from '../src/modules/catalog/application/services/catalog-search.service';
import { SearchResponseDto } from '../src/modules/catalog/presentation/dtos/search.dto';
import {
  MEDIA_REPOSITORY,
  IMediaRepository,
} from '../src/modules/catalog/domain/repositories/media.repository.interface';
import { TmdbAdapter } from '../src/modules/tmdb/tmdb.adapter';

type MediaSummary = {
  id: string;
  type: MediaType;
  title: string;
  slug: string;
  poster: null;
  backdrop: null;
};

type MediaStateWithSummary = UserMediaState & { mediaSummary: MediaSummary };

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

class InMemoryUserMediaRepository implements IUserMediaStateRepository {
  private states: MediaStateWithSummary[] = [];

  private makeSummary(mediaItemId: string): MediaSummary {
    return {
      id: mediaItemId,
      type: MediaType.MOVIE,
      title: `Title ${mediaItemId}`,
      slug: `slug-${mediaItemId}`,
      poster: null,
    } as MediaSummary;
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
    const created: MediaStateWithSummary = {
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
    };
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

  async listWithMedia(userId: string, limit = 20, offset = 0) {
    return this.states.filter((s) => s.userId === userId).slice(offset, offset + limit);
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

class FakeMovieRepository implements IMovieRepository {
  public throwOnTrending = false;
  public lastNowPlayingOptions: NowPlayingOptions | undefined;
  public lastNewReleasesOptions: NowPlayingOptions | undefined;
  public lastNewOnDigitalOptions: NowPlayingOptions | undefined;
  public lastTrendingOptions: any;

  private items: MovieWithMedia[] = [
    {
      id: 'mid-1',
      mediaItemId: 'mid-1',
      tmdbId: 1,
      title: 'Movie One',
      slug: 'movie-one',
      overview: null,
      ingestionStatus: 'ready' as any,
      poster: null,
      backdrop: null,
      popularity: 10,
      releaseDate: new Date('2024-01-01'),
      videos: null,
      stats: {
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        liveWatchers: null,
        totalWatchers: null,
      },
      externalRatings: {
        tmdb: { rating: 7, voteCount: 100 },
        imdb: null,
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      },
      theatricalReleaseDate: null,
      digitalReleaseDate: null,
      runtime: null,
      genres: [],
    },
    {
      id: 'mid-2',
      mediaItemId: 'mid-2',
      tmdbId: 2,
      title: 'Movie Two',
      slug: 'movie-two',
      overview: null,
      ingestionStatus: 'ready' as any,
      poster: null,
      backdrop: null,
      popularity: 8,
      releaseDate: new Date('2024-02-01'),
      videos: null,
      stats: {
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        liveWatchers: null,
        totalWatchers: null,
      },
      externalRatings: {
        tmdb: { rating: 6.5, voteCount: 50 },
        imdb: null,
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      },
      theatricalReleaseDate: null,
      digitalReleaseDate: null,
      runtime: null,
      genres: [],
    },
  ];

  async findNowPlaying(options?: NowPlayingOptions): Promise<MovieWithMedia[]> {
    this.lastNowPlayingOptions = options;
    return this.slice(options);
  }

  async findNewReleases(options?: NowPlayingOptions): Promise<MovieWithMedia[]> {
    this.lastNewReleasesOptions = options;
    return this.slice(options);
  }

  async findNewOnDigital(options?: NowPlayingOptions): Promise<MovieWithMedia[]> {
    this.lastNewOnDigitalOptions = options;
    return this.slice(options);
  }

  async findTrending(options?: any): Promise<any[]> {
    if (this.throwOnTrending) {
      throw new Error('boom');
    }
    this.lastTrendingOptions = options;
    const limit = options?.limit ?? this.items.length;
    const offset = options?.offset ?? 0;
    return this.items.slice(offset, offset + limit);
  }

  async setNowPlaying(): Promise<void> {
    return;
  }

  async updateReleaseDates(): Promise<void> {
    return;
  }

  async upsertDetails(): Promise<void> {
    return;
  }

  async findBySlug(slug: string): Promise<any | null> {
    return this.items.find((m) => m.slug === slug) ?? null;
  }

  private slice(options?: NowPlayingOptions) {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    return this.items.slice(offset, offset + limit);
  }
}

class FakeShowRepository implements IShowRepository {
  private items = [
    {
      id: 'sid-1',
      mediaItemId: 'sid-1',
      tmdbId: 101,
      title: 'Show One',
      originalTitle: null,
      slug: 'show-one',
      overview: null,
      ingestionStatus: 'ready' as any,
      poster: null,
      backdrop: null,
      videos: null,
      primaryTrailer: null,
      credits: null,
      availability: null,
      stats: {
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        liveWatchers: null,
        totalWatchers: null,
      },
      externalRatings: {
        tmdb: { rating: 7, voteCount: 20 },
        imdb: null,
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      },
      totalSeasons: 1,
      totalEpisodes: 10,
      status: null,
      lastAirDate: null,
      nextAirDate: null,
      genres: [],
      seasons: [],
    },
    {
      id: 'sid-2',
      mediaItemId: 'sid-2',
      tmdbId: 102,
      title: 'Show Two',
      originalTitle: null,
      slug: 'show-two',
      overview: null,
      ingestionStatus: 'ready' as any,
      poster: null,
      backdrop: null,
      videos: null,
      primaryTrailer: null,
      credits: null,
      availability: null,
      stats: {
        ratingoScore: null,
        qualityScore: null,
        popularityScore: null,
        liveWatchers: null,
        totalWatchers: null,
      },
      externalRatings: {
        tmdb: { rating: 6, voteCount: 10 },
        imdb: null,
        trakt: null,
        metacritic: null,
        rottenTomatoes: null,
      },
      totalSeasons: 1,
      totalEpisodes: 8,
      status: null,
      lastAirDate: null,
      nextAirDate: null,
      genres: [],
      seasons: [],
    },
  ];

  async upsertDetails(): Promise<void> {
    return;
  }

  async findShowsForAnalysis(): Promise<any[]> {
    return [];
  }

  async saveDropOffAnalysis(): Promise<void> {
    return;
  }

  async getDropOffAnalysis(): Promise<any | null> {
    return null;
  }

  async findEpisodesByDateRange(start: Date, end: Date): Promise<CalendarEpisode[]> {
    return [
      {
        showId: 'sid-1',
        showTitle: 'Show One',
        posterPath: null,
        seasonNumber: 1,
        episodeNumber: 1,
        title: 'Pilot',
        overview: null,
        airDate: start,
        runtime: 45,
        stillPath: null,
      },
    ];
  }

  async findTrending(options: TrendingShowsOptions): Promise<any[]> {
    const limit = options?.limit ?? this.items.length;
    const offset = options?.offset ?? 0;
    return this.items.slice(offset, offset + limit).map((s) => ({ ...s, type: 'show' }));
  }

  async findBySlug(slug: string): Promise<any | null> {
    return this.items.find((s) => s.slug === slug) ?? null;
  }
}

class FakeMediaRepository implements IMediaRepository {
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

describe('Catalog e2e', () => {
  let app: INestApplication;
  let moviesRepo: FakeMovieRepository;
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

  beforeAll(async () => {
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

    moviesRepo = moduleFixture.get(MOVIE_REPOSITORY) as unknown as FakeMovieRepository;

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

  it('movies trending: anon returns userState null, auth enriches', async () => {
    const anonRes = await request(app.getHttpServer())
      .get(`${catalogBase}/movies/trending`)
      .expect(200);

    expect(anonRes.body.success).toBe(true);
    expect(anonRes.body.data.data.every((m: any) => m.userState === null)).toBe(true);

    const token = await registerAndLogin();
    await setUserState(token, 'mid-1');

    const authRes = await request(app.getHttpServer())
      .get(`${catalogBase}/movies/trending`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const withState = authRes.body.data.data.find((m: any) => m.id === 'mid-1');
    const withoutState = authRes.body.data.data.find((m: any) => m.id === 'mid-2');
    expect(withState.userState).not.toBeNull();
    expect(withoutState.userState).toBeNull();
  });

  it('movies trending: supports default meta and pagination via limit/offset', async () => {
    const defaultRes = await request(app.getHttpServer())
      .get(`${catalogBase}/movies/trending`)
      .expect(200);

    expect(defaultRes.body.success).toBe(true);
    expect(defaultRes.body.data.meta.limit).toBe(20);
    expect(defaultRes.body.data.meta.offset).toBe(0);
    expect(defaultRes.body.data.meta.count).toBe(2);

    const paged = await request(app.getHttpServer())
      .get(`${catalogBase}/movies/trending?limit=1&offset=1`)
      .expect(200);

    expect(paged.body.data.data.length).toBe(1);
    expect(paged.body.data.data[0].id).toBe('mid-2');
    expect(paged.body.data.meta.limit).toBe(1);
    expect(paged.body.data.meta.offset).toBe(1);
  });

  const trendingValidationQueries = ['?limit=0', '?limit=101', '?offset=-1', '?genreId=not-a-uuid'];
  [
    { name: 'movies', url: `${catalogBase}/movies/trending` },
    { name: 'shows', url: `${catalogBase}/shows/trending` },
  ].forEach(({ name, url }) => {
    it(`${name} trending: validates query params (limit/offset/genreId)`, async () => {
      for (const q of trendingValidationQueries) {
        await get(`${url}${q}`).expect(400);
      }
    });
  });

  it('shows trending: anon vs auth enrichment', async () => {
    const anonRes = await request(app.getHttpServer())
      .get(`${catalogBase}/shows/trending`)
      .expect(200);
    expect(anonRes.body.success).toBe(true);
    expect(anonRes.body.data.data.every((s: any) => s.userState === null)).toBe(true);

    const token = await registerAndLogin();
    await setUserState(token, 'sid-1');

    const authRes = await request(app.getHttpServer())
      .get(`${catalogBase}/shows/trending`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const withState = authRes.body.data.data.find((s: any) => s.id === 'sid-1');
    const withoutState = authRes.body.data.data.find((s: any) => s.id === 'sid-2');
    expect(withState.userState).not.toBeNull();
    expect(withoutState.userState).toBeNull();
  });

  it('movies now-playing/new-releases/new-on-digital respond with meta and userState', async () => {
    const token = await registerAndLogin();
    await setUserState(token, 'mid-1');

    const endpoints = ['now-playing', 'new-releases', 'new-on-digital'];
    for (const ep of endpoints) {
      const res = await request(app.getHttpServer())
        .get(`${catalogBase}/movies/${ep}?limit=1&offset=0`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data.meta.limit).toBe(1);
      expect(res.body.data.meta.offset).toBe(0);
      const item = res.body.data.data[0];
      expect(item.userState).not.toBeNull();
    }
  });

  it('movies now-playing: defaults limit/offset when query params missing', async () => {
    const res = await get(`${catalogBase}/movies/now-playing`).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.meta.limit).toBe(20);
    expect(res.body.data.meta.offset).toBe(0);
    expect(res.body.data.meta.count).toBe(2);
  });

  it('movies new-releases: forwards daysBack and applies default when 0/undefined', async () => {
    await request(app.getHttpServer())
      .get(`${catalogBase}/movies/new-releases?daysBack=15&limit=1&offset=0`)
      .expect(200);
    expect(moviesRepo.lastNewReleasesOptions?.daysBack).toBe(15);

    await request(app.getHttpServer())
      .get(`${catalogBase}/movies/new-releases?daysBack=0&limit=1&offset=0`)
      .expect(200);
    expect(moviesRepo.lastNewReleasesOptions?.daysBack).toBe(30);

    await request(app.getHttpServer())
      .get(`${catalogBase}/movies/new-releases?limit=1&offset=0`)
      .expect(200);
    expect(moviesRepo.lastNewReleasesOptions?.daysBack).toBe(30);
  });

  it('calendar returns grouped days', async () => {
    const res = await request(app.getHttpServer()).get(`${catalogBase}/shows/calendar`).expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.days)).toBe(true);
    expect(res.body.data.days.length).toBeGreaterThan(0);
    expect(res.body.data.days[0].episodes.length).toBeGreaterThan(0);
  });

  it('calendar respects startDate and days parameters', async () => {
    const startDate = '2024-01-01T00:00:00.000Z';
    const res = await request(app.getHttpServer())
      .get(`${catalogBase}/shows/calendar?startDate=${encodeURIComponent(startDate)}&days=1`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.startDate).toBe(startDate);
    expect(res.body.data.days[0].date).toBe('2024-01-01');
  });

  it('movie detail: anon vs auth userState and 404', async () => {
    const anon = await request(app.getHttpServer())
      .get(`${catalogBase}/movies/movie-one`)
      .expect(200);
    expect(anon.body.data.userState).toBeNull();

    const token = await registerAndLogin();
    await setUserState(token, 'mid-1');

    const auth = await request(app.getHttpServer())
      .get(`${catalogBase}/movies/movie-one`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(auth.body.data.userState).not.toBeNull();

    await request(app.getHttpServer()).get(`${catalogBase}/movies/unknown`).expect(404);
  });

  it('show detail: anon vs auth userState and 404', async () => {
    const anon = await request(app.getHttpServer())
      .get(`${catalogBase}/shows/show-one`)
      .expect(200);
    expect(anon.body.data.userState).toBeNull();

    const token = await registerAndLogin();
    await setUserState(token, 'sid-1');

    const auth = await request(app.getHttpServer())
      .get(`${catalogBase}/shows/show-one`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(auth.body.data.userState).not.toBeNull();

    await request(app.getHttpServer()).get(`${catalogBase}/shows/unknown`).expect(404);
  });

  it('invalid token behaves as anonymous (OptionalJwtAuthGuard)', async () => {
    const res = await request(app.getHttpServer())
      .get(`${catalogBase}/movies/trending`)
      .set('Authorization', 'Bearer invalid')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.data.every((m: any) => m.userState === null)).toBe(true);
  });

  it('search returns stubbed result without external calls', async () => {
    const res = await request(app.getHttpServer())
      .get(`${catalogBase}/search?query=mo`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.local.length).toBe(1);
    expect(res.body.data.local[0].id).toBe('mid-1');
  });

  it('search returns empty results for missing/too short query', async () => {
    const missing = await request(app.getHttpServer()).get(`${catalogBase}/search`).expect(200);
    expect(missing.body.success).toBe(true);
    expect(missing.body.data.local.length).toBe(0);
    expect(missing.body.data.tmdb.length).toBe(0);

    const short = await request(app.getHttpServer())
      .get(`${catalogBase}/search?query=a`)
      .expect(200);
    expect(short.body.success).toBe(true);
    expect(short.body.data.local.length).toBe(0);
    expect(short.body.data.tmdb.length).toBe(0);
  });

  it('movies trending returns 500 error envelope when repository throws', async () => {
    moviesRepo.throwOnTrending = true;
    const res = await request(app.getHttpServer())
      .get(`${catalogBase}/movies/trending`)
      .expect(500);
    moviesRepo.throwOnTrending = false;

    expect(res.body.success).toBe(false);
    expect(res.body.error.statusCode).toBe(500);
  });
});
