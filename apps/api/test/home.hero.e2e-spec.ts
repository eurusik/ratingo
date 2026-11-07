import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { HomeController } from '../src/modules/home/presentation/home.controller';
import { HomeService } from '../src/modules/home/application/home.service';
import { HERO_REPOSITORY, type IHeroRepository } from '../src/modules/home/public';
import { MediaType } from '../src/common/enums/media-type.enum';
import { type ImageData } from '../src/common/types/media.types';
import { createE2eApp } from './support/e2e-testing-module';
import { testUuid } from './support/test-uuid';

const HERO_MEDIA_ITEM_ID = testUuid('hero-movie');

const buildImage = (kind: string): ImageData => ({
  thumb: `${kind}-thumb`,
  small: `${kind}-small`,
  medium: `${kind}-medium`,
  large: `${kind}-large`,
  original: `${kind}-original`,
});

describe('Home e2e - Hero', () => {
  let app: INestApplication;

  const heroRepository: jest.Mocked<Pick<IHeroRepository, 'findHero'>> = {
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
        id: HERO_MEDIA_ITEM_ID,
        mediaItemId: HERO_MEDIA_ITEM_ID,
        type: MediaType.MOVIE,
        slug: 'movie-one',
        title: 'Movie One',
        originalTitle: 'Movie One',
        overview: null,
        primaryTrailerKey: null,
        poster: buildImage('poster'),
        backdrop: buildImage('backdrop'),
        stats: {
          ratingoScore: 80,
          qualityScore: 70,
          popularityScore: null,
          liveWatchers: null,
          totalWatchers: null,
        },
        externalRatings: {},
        releaseDate: null,
        isNew: false,
        isClassic: false,
      },
    ]);

    const res = await request(app.getHttpServer()).get('/api/home/hero').expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: HERO_MEDIA_ITEM_ID,
      mediaItemId: HERO_MEDIA_ITEM_ID,
    });
  });
});
