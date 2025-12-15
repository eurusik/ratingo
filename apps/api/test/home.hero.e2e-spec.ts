import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HomeController } from '../src/modules/home/presentation/home.controller';
import { HomeService } from '../src/modules/home/application/home.service';
import { MEDIA_REPOSITORY } from '../src/modules/catalog/domain/repositories/media.repository.interface';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { MediaType } from '../src/common/enums/media-type.enum';

describe('Home e2e - Hero', () => {
  let app: INestApplication;

  const mediaRepository = {
    findHero: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [HomeService, { provide: MEDIA_REPOSITORY, useValue: mediaRepository }],
    }).compile();

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

  it('returns hero items with explicit mediaItemId alias', async () => {
    mediaRepository.findHero.mockResolvedValue([
      {
        id: 'mid-1',
        mediaItemId: 'mid-1',
        type: MediaType.MOVIE,
        slug: 'movie-one',
        title: 'Movie One',
        originalTitle: 'Movie One',
        overview: null,
        primaryTrailerKey: null,
        poster: { small: 'p' },
        backdrop: { small: 'b' },
        stats: { ratingoScore: 80, qualityScore: 70 },
        releaseDate: null,
        isNew: false,
        isClassic: false,
      },
    ]);

    const res = await request(app.getHttpServer()).get('/api/home/hero').expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((i: any) => i.mediaItemId && i.mediaItemId === i.id)).toBe(true);
  });
});
