/**
 * Catalog Providers E2E Tests
 *
 * Tests for GET /api/catalog/providers endpoint.
 *
 * Real data structure:
 * { "US": { "flatrate": [...], "buy": [{ "name": "Netflix", ... }], "rent": [...] } }
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import authConfig from '../../src/config/auth.config';
import { CatalogModule } from '../../src/modules/catalog/catalog.module';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { DATABASE_CONNECTION } from '../../src/database/database.module';
import { MOVIE_REPOSITORY } from '../../src/modules/catalog/domain/repositories/movie.repository.interface';
import { SHOW_REPOSITORY } from '../../src/modules/catalog/domain/repositories/show.repository.interface';
import { MEDIA_REPOSITORY } from '../../src/modules/catalog/domain/repositories/media.repository.interface';
import { GENRE_REPOSITORY } from '../../src/modules/catalog/domain/repositories/genre.repository.interface';
import { PROVIDERS_REPOSITORY } from '../../src/modules/catalog/infrastructure/repositories/providers.repository';
import { TmdbAdapter } from '../../src/modules/tmdb/tmdb.adapter';
import { CatalogSearchService } from '../../src/modules/catalog/application/services/catalog-search.service';
import { FakeMovieRepository, FakeShowRepository } from './_fakes';

class FakeProvidersRepository {
  private providers = [
    { id: 'netflix', name: 'Netflix', count: 1500 },
    { id: 'amazon prime video', name: 'Amazon Prime Video', count: 1200 },
    { id: 'disney plus', name: 'Disney Plus', count: 800 },
    { id: 'hbo max', name: 'HBO Max', count: 600 },
    { id: 'apple tv+', name: 'Apple TV+', count: 400 },
  ];

  async findAllProviders() {
    return this.providers;
  }

  setProviders(providers: Array<{ id: string; name: string; count: number }>) {
    this.providers = providers;
  }
}

class FakeMediaRepository {
  async findByTmdbId() {
    return null;
  }
  async search() {
    return [];
  }
  async findHero() {
    return [];
  }
}

class FakeGenreRepository {
  async findAll() {
    return [];
  }
}

class FakeCatalogSearchService {
  async search() {
    return { query: '', local: [], tmdb: [] };
  }
}

describe('Catalog E2E - Providers', () => {
  let app: INestApplication;
  let providersRepo: FakeProvidersRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [authConfig], ignoreEnvFile: true }),
        CatalogModule,
      ],
    })
      .overrideProvider(DATABASE_CONNECTION)
      .useValue({})
      .overrideProvider(MOVIE_REPOSITORY)
      .useClass(FakeMovieRepository)
      .overrideProvider(SHOW_REPOSITORY)
      .useClass(FakeShowRepository)
      .overrideProvider(MEDIA_REPOSITORY)
      .useClass(FakeMediaRepository)
      .overrideProvider(GENRE_REPOSITORY)
      .useClass(FakeGenreRepository)
      .overrideProvider(PROVIDERS_REPOSITORY)
      .useClass(FakeProvidersRepository)
      .overrideProvider(TmdbAdapter)
      .useValue({ searchMulti: () => [] })
      .overrideProvider(CatalogSearchService)
      .useClass(FakeCatalogSearchService)
      .compile();

    providersRepo = moduleFixture.get(PROVIDERS_REPOSITORY) as FakeProvidersRepository;

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

  describe('GET /api/catalog/providers', () => {
    it('should return list of providers', async () => {
      const res = await request(app.getHttpServer()).get('/api/catalog/providers').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toHaveLength(5);
      expect(res.body.data.data[0]).toEqual({
        id: 'netflix',
        name: 'Netflix',
        count: 1500,
      });
    });

    it('should return providers sorted by count (highest first)', async () => {
      const res = await request(app.getHttpServer()).get('/api/catalog/providers').expect(200);

      const counts = res.body.data.data.map((p: any) => p.count);
      expect(counts).toEqual([1500, 1200, 800, 600, 400]);
    });

    it('should preserve provider name casing', async () => {
      const res = await request(app.getHttpServer()).get('/api/catalog/providers').expect(200);

      const names = res.body.data.data.map((p: any) => p.name);
      expect(names).toContain('HBO Max');
      expect(names).toContain('Apple TV+');
      expect(names).toContain('Amazon Prime Video');
    });

    it('should return empty list when no providers exist', async () => {
      providersRepo.setProviders([]);

      const res = await request(app.getHttpServer()).get('/api/catalog/providers').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toEqual([]);

      // Reset for other tests
      providersRepo.setProviders([
        { id: 'netflix', name: 'Netflix', count: 1500 },
        { id: 'amazon prime video', name: 'Amazon Prime Video', count: 1200 },
        { id: 'disney plus', name: 'Disney Plus', count: 800 },
        { id: 'hbo max', name: 'HBO Max', count: 600 },
        { id: 'apple tv+', name: 'Apple TV+', count: 400 },
      ]);
    });

    it('should include providers with zero count', async () => {
      providersRepo.setProviders([
        { id: 'netflix', name: 'Netflix', count: 100 },
        { id: 'new-service', name: 'New Service', count: 0 },
      ]);

      const res = await request(app.getHttpServer()).get('/api/catalog/providers').expect(200);

      expect(res.body.data.data).toHaveLength(2);
      expect(res.body.data.data[1].count).toBe(0);
    });
  });
});
