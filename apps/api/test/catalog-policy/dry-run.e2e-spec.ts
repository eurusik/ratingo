/**
 * Dry-Run E2E Tests
 *
 * Tests the dry-run functionality for previewing policy changes
 * without affecting production data.
 */

import { createCatalogPolicyApp, CatalogPolicyE2eContext, createTestPolicy } from './_harness';

describe('Dry-Run API (e2e)', () => {
  let ctx: CatalogPolicyE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogPolicyApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('POST /dry-run', () => {
    it('should execute dry-run with sample mode', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US', 'UA'],
            blockedCountries: ['RU'],
            allowedLanguages: ['en', 'uk'],
            blockedLanguages: ['ru'],
          }),
          options: {
            mode: 'sample',
            samplePercent: 10,
            limit: 50,
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.mode).toBe('sample');
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should execute dry-run with top mode', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy(),
          options: {
            mode: 'top',
            limit: 100,
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.mode).toBe('top');
    });

    it('should include reason breakdown in summary', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            allowedCountries: ['US'],
            blockedCountries: ['RU', 'BY'],
          }),
          options: {
            mode: 'sample',
            limit: 10,
          },
        })
        .expect(200);

      expect(res.body.data.summary.reasonBreakdown).toBeDefined();
      expect(Array.isArray(res.body.data.summary.reasonBreakdown)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const limit = 25;
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy(),
          options: {
            mode: 'sample',
            limit,
          },
        })
        .expect(200);

      expect(res.body.data.summary.limit).toBe(limit);
    });

    it('should validate blockedCountryMode', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: {
            ...createTestPolicy(),
            blockedCountryMode: 'INVALID',
          },
          options: { mode: 'sample', limit: 10 },
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should validate eligibilityMode', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: {
            ...createTestPolicy(),
            eligibilityMode: 'INVALID',
          },
          options: { mode: 'sample', limit: 10 },
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should accept breakout rules in policy', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            breakoutRules: [
              {
                id: 'global-phenomenon',
                name: 'Global Phenomenon',
                priority: 0,
                requirements: {
                  minImdbVotes: 500000,
                  minQualityScoreNormalized: 0.7,
                },
              },
              {
                id: 'viral-hit',
                name: 'Viral Hit',
                priority: 1,
                requirements: {
                  minImdbVotes: 100000,
                },
              },
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should include execution time in summary', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy(),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      expect(res.body.data.summary.executionTimeMs).toBeDefined();
      expect(typeof res.body.data.summary.executionTimeMs).toBe('number');
    });
  });

  describe('Dry-run policy validation', () => {
    it('should require allowedCountries', async () => {
      const policy = createTestPolicy();
      delete (policy as any).allowedCountries;

      const res = await ctx
        .post('/dry-run', {
          policy,
          options: { mode: 'sample', limit: 10 },
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should require allowedLanguages', async () => {
      const policy = createTestPolicy();
      delete (policy as any).allowedLanguages;

      const res = await ctx
        .post('/dry-run', {
          policy,
          options: { mode: 'sample', limit: 10 },
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should accept STRICT eligibility mode', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({ eligibilityMode: 'STRICT' }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should accept RELAXED eligibility mode', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({ eligibilityMode: 'RELAXED' }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should validate breakout rule structure', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy({
            breakoutRules: [
              {
                // missing id
                name: 'Invalid Rule',
                priority: 0,
                requirements: {},
              } as any,
            ],
          }),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Dry-run options', () => {
    it('should accept byType mode with mediaType', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy(),
          options: { mode: 'byType', limit: 10, mediaType: 'movie' },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should accept byCountry mode with country', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy(),
          options: { mode: 'byCountry', limit: 10, country: 'US' },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should include timedOut flag in summary', async () => {
      const res = await ctx
        .post('/dry-run', {
          policy: createTestPolicy(),
          options: { mode: 'sample', limit: 10 },
        })
        .expect(200);

      expect(res.body.data.summary.timedOut).toBeDefined();
      expect(typeof res.body.data.summary.timedOut).toBe('boolean');
    });
  });
});
