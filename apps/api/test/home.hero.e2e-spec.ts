import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HomeController } from '../src/modules/home/presentation/home.controller';
import { HomeService } from '../src/modules/home/application/home.service';
import { HERO_REPOSITORY } from '../src/modules/home/public';
import { MediaType } from '../src/common/enums/media-type.enum';
import { createE2eApp } from './support/e2e-testing-module';
import { testUuid } from './support/test-uuid';

describe('Home e2e - Hero', () => {
  let app: INestApplication;

  const heroRepository = {
    findHero: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [HomeService, { provide: HERO_REPOSITORY, useValue: heroRepository }],
    }).compile();

    app = await createE2eApp(moduleFixture);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns hero items with explicit mediaItemId alias', async () => {
    heroRepository.findHero.mockResolvedValue([
      {
        id: testUuid('mid-1'),
        mediaItemId: testUuid('mid-1'),
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
