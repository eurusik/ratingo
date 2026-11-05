import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { InsightsController } from '../src/modules/insights/presentation/controllers/insights.controller';
import { InsightsService } from '../src/modules/insights/application/services/insights.service';
import { INSIGHTS_REPOSITORY } from '../src/modules/insights/domain/repositories/insights.repository.interface';
import { createE2eApp } from './support/e2e-testing-module';
import { testUuid } from './support/test-uuid';

describe('Insights e2e - Movements', () => {
  let app: INestApplication;

  const insightsRepository = {
    getMovements: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [InsightsService, { provide: INSIGHTS_REPOSITORY, useValue: insightsRepository }],
    }).compile();

    app = await createE2eApp(moduleFixture);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns movements items with explicit mediaItemId alias', async () => {
    insightsRepository.getMovements.mockResolvedValue({
      risers: [
        {
          id: testUuid('mid-1'),
          mediaItemId: testUuid('mid-1'),
          type: 'movie',
          slug: 'm1',
          title: 'Movie 1',
          originalTitle: null,
          poster: null,
          backdrop: null,
          stats: {
            deltaWatchers: 10,
            deltaPercent: null,
            currentWatchers: 100,
            growthCurrent: 10,
            growthPrev: 0,
            isNewInTrends: true,
          },
        },
      ],
      fallers: [],
    });

    const res = await request(app.getHttpServer())
      .get('/api/insights/movements?window=30d&limit=5')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.risers)).toBe(true);
    expect(res.body.data.risers.every((i: any) => i.mediaItemId && i.mediaItemId === i.id)).toBe(
      true,
    );
    expect(Array.isArray(res.body.data.fallers)).toBe(true);
    expect(res.body.data.fallers.every((i: any) => i.mediaItemId && i.mediaItemId === i.id)).toBe(
      true,
    );
  });
});
