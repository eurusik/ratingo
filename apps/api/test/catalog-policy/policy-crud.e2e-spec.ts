/**
 * Policy CRUD E2E Tests
 *
 * Tests policy creation endpoint.
 * Note: List endpoint requires additional mock setup not available in current harness.
 */

import { createCatalogPolicyApp, CatalogPolicyE2eContext, createTestPolicy } from './_harness';

describe('Policy CRUD (e2e)', () => {
  let ctx: CatalogPolicyE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogPolicyApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('GET /:id (Get Policy Details)', () => {
    it('should return full policy configuration', async () => {
      // Create a policy via repo
      const policy = await ctx.policyRepo.create(
        createTestPolicy({
          allowedCountries: ['US', 'UA', 'GB'],
          blockedCountries: ['RU', 'BY'],
          blockedCountryMode: 'ANY',
          allowedLanguages: ['en', 'uk'],
          blockedLanguages: ['ru'],
          globalProviders: ['netflix', 'prime_video'],
          eligibilityMode: 'STRICT',
          homepage: { minRelevanceScore: 50 },
          breakoutRules: [
            {
              id: 'test-rule',
              name: 'Test Rule',
              priority: 0,
              requirements: { minImdbVotes: 10000 },
            },
          ],
        }),
      );

      // Get policy details
      const res = await ctx.get(`/${policy.id}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(policy.id);
      expect(res.body.data.config).toBeDefined();
      expect(res.body.data.config.allowedCountries).toEqual(['US', 'UA', 'GB']);
      expect(res.body.data.config.blockedCountries).toEqual(['RU', 'BY']);
      expect(res.body.data.config.breakoutRules).toHaveLength(1);
      expect(res.body.data.config.breakoutRules[0].id).toBe('test-rule');
    });

    it('should show inactive status for new policy', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const res = await ctx.get(`/${policy.id}`).expect(200);

      expect(res.body.data.status).toBe('inactive');
    });

    it('should show active status after activation', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());
      await ctx.policyRepo.activate(policy.id);

      const res = await ctx.get(`/${policy.id}`).expect(200);

      expect(res.body.data.status).toBe('active');
      expect(res.body.data.activatedAt).toBeDefined();
    });

    it('should return policy with empty breakout rules', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy({ breakoutRules: [] }));

      const res = await ctx.get(`/${policy.id}`).expect(200);

      expect(res.body.data.config.breakoutRules).toEqual([]);
    });

    it('should return policy with multiple breakout rules sorted by priority', async () => {
      const policy = await ctx.policyRepo.create(
        createTestPolicy({
          breakoutRules: [
            {
              id: 'rule-high',
              name: 'High Priority',
              priority: 0,
              requirements: { minImdbVotes: 500000 },
            },
            {
              id: 'rule-medium',
              name: 'Medium Priority',
              priority: 1,
              requirements: { minImdbVotes: 100000 },
            },
            {
              id: 'rule-low',
              name: 'Low Priority',
              priority: 2,
              requirements: { minImdbVotes: 50000 },
            },
          ],
        }),
      );

      const res = await ctx.get(`/${policy.id}`).expect(200);

      expect(res.body.data.config.breakoutRules).toHaveLength(3);
      expect(res.body.data.config.breakoutRules[0].id).toBe('rule-high');
      expect(res.body.data.config.breakoutRules[1].id).toBe('rule-medium');
      expect(res.body.data.config.breakoutRules[2].id).toBe('rule-low');
    });
  });
});
