/**
 * Policy Activation E2E Tests
 *
 * Tests the full policy activation flow: Prepare → Poll → Diff → Promote/Cancel
 */

import { createCatalogPolicyApp, CatalogPolicyE2eContext, createTestPolicy } from './_harness';
import {
  RunStatus,
  ACTIVE_EVALUATION_CONTEXTS,
} from '../../src/modules/catalog-policy/domain/constants/evaluation.constants';

describe('Policy Activation Flow (e2e)', () => {
  let ctx: CatalogPolicyE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogPolicyApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(() => {
    // Reset state between tests
    ctx.queue.clear();
  });

  describe('GET /:id', () => {
    it('should return 404 when policy not found', async () => {
      const res = await ctx.get('/non-existent-id').expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return policy with full config', async () => {
      const policyConfig = createTestPolicy({
        allowedCountries: ['US', 'GB', 'UA'],
        blockedCountries: ['RU', 'BY'],
        blockedCountryMode: 'ANY',
        allowedLanguages: ['en', 'uk'],
        blockedLanguages: ['ru'],
        globalProviders: ['netflix', 'prime', 'disney'],
        eligibilityMode: 'STRICT',
        homepage: { minRelevanceScore: 50 },
        breakoutRules: [
          {
            id: 'high-quality',
            name: 'High Quality Exception',
            priority: 1,
            requirements: {
              minImdbVotes: 10000,
              minQualityScoreNormalized: 0.7,
            },
          },
        ],
      });

      const policy = await ctx.policyRepo.create(policyConfig);

      const res = await ctx.get(`/${policy.id}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(policy.id);
      expect(res.body.data.name).toBe(`Policy v${policy.version}`);
      expect(res.body.data.version).toBe(String(policy.version));
      expect(res.body.data.status).toBe('inactive');

      // Verify config
      const config = res.body.data.config;
      expect(config).toBeDefined();
      expect(config.allowedCountries).toEqual(['US', 'GB', 'UA']);
      expect(config.blockedCountries).toEqual(['RU', 'BY']);
      expect(config.blockedCountryMode).toBe('ANY');
      expect(config.allowedLanguages).toEqual(['en', 'uk']);
      expect(config.blockedLanguages).toEqual(['ru']);
      expect(config.globalProviders).toEqual(['netflix', 'prime', 'disney']);
      expect(config.eligibilityMode).toBe('STRICT');
      expect(config.homepage.minRelevanceScore).toBe(50);

      // Verify breakout rules
      expect(config.breakoutRules).toHaveLength(1);
      expect(config.breakoutRules[0].id).toBe('high-quality');
      expect(config.breakoutRules[0].name).toBe('High Quality Exception');
      expect(config.breakoutRules[0].priority).toBe(1);
      expect(config.breakoutRules[0].requirements.minImdbVotes).toBe(10000);
      expect(config.breakoutRules[0].requirements.minQualityScoreNormalized).toBe(0.7);
    });

    it('should return active status for activated policy', async () => {
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

    it('should return policy with multiple breakout rules', async () => {
      const policy = await ctx.policyRepo.create(
        createTestPolicy({
          breakoutRules: [
            {
              id: 'rule-1',
              name: 'Rule 1',
              priority: 1,
              requirements: { minImdbVotes: 5000 },
            },
            {
              id: 'rule-2',
              name: 'Rule 2',
              priority: 2,
              requirements: { requireAnyOfProviders: ['netflix'] },
            },
            {
              id: 'rule-3',
              name: 'Rule 3',
              priority: 3,
              requirements: {
                minQualityScoreNormalized: 0.8,
                requireAnyOfRatingsPresent: ['imdb', 'rt'],
              },
            },
          ],
        }),
      );

      const res = await ctx.get(`/${policy.id}`).expect(200);

      expect(res.body.data.config.breakoutRules).toHaveLength(3);
      expect(res.body.data.config.breakoutRules[0].id).toBe('rule-1');
      expect(res.body.data.config.breakoutRules[1].id).toBe('rule-2');
      expect(res.body.data.config.breakoutRules[2].id).toBe('rule-3');
    });
  });

  describe('POST /:id/prepare', () => {
    it('should return 404 when policy not found', async () => {
      const res = await ctx.post('/non-existent-id/prepare').expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should create run and queue job for valid policy', async () => {
      // Seed a policy
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const res = await ctx.post(`/${policy.id}/prepare`).expect(202);

      expect(res.body.success).toBe(true);
      expect(res.body.data.runId).toBeDefined();
      expect(res.body.data.status).toBe('running');
      expect(res.body.data.message).toContain('Policy preparation started');

      // Verify run was created
      const run = await ctx.runRepo.findById(res.body.data.runId);
      expect(run).not.toBeNull();
      expect(run!.targetPolicyId).toBe(policy.id);
      expect(run!.status).toBe(RunStatus.RUNNING);

      // Verify job was queued
      expect(ctx.queue.jobs.length).toBeGreaterThan(0);
      expect(ctx.queue.jobs[0].name).toBe('re-evaluate-all');
    });
  });

  describe('GET /runs/:runId', () => {
    it('should return 404 when run not found', async () => {
      const res = await ctx.get('/runs/non-existent-run').expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should return run status with counters', async () => {
      // Create a policy and run
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      // Simulate some progress
      await ctx.runRepo.incrementCounters(run.id, {
        processed: 50,
        eligible: 30,
        ineligible: 15,
      });

      const res = await ctx.get(`/runs/${run.id}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(run.id);
      expect(res.body.data.status).toBe('running');
      expect(res.body.data.progress.total).toBe(100);
      expect(res.body.data.progress.processed).toBe(50);
      expect(res.body.data.progress.eligible).toBe(30);
      expect(res.body.data.progress.ineligible).toBe(15);
      expect(res.body.data.coverage).toBe(0.5); // 50/100
    });

    it('should show readyToPromote when run is prepared', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      // Complete the run - mark as PREPARED (ready for promotion)
      await ctx.runRepo.update(run.id, {
        status: RunStatus.PREPARED,
        finishedAt: new Date(),
      });
      await ctx.runRepo.incrementCounters(run.id, {
        processed: 100,
        eligible: 80,
        ineligible: 20,
      });

      const res = await ctx.get(`/runs/${run.id}`).expect(200);

      expect(res.body.data.status).toBe('prepared');
      expect(res.body.data.readyToPromote).toBe(true);
      expect(res.body.data.coverage).toBe(1);
    });
  });

  describe('POST /runs/:runId/promote', () => {
    it('should return 404 when run not found', async () => {
      const res = await ctx.post('/runs/non-existent/promote').expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error).toContain('not found');
    });

    it('should reject promotion of running run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      const res = await ctx.post(`/runs/${run.id}/promote`).expect(201);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error).toContain('expected prepared');
    });

    it('should reject promotion with insufficient coverage', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.PREPARED });
      await ctx.runRepo.incrementCounters(run.id, { processed: 50 }); // Only 50%

      const res = await ctx.post(`/runs/${run.id}/promote`).expect(201);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error).toContain('Coverage');
    });

    it('should promote prepared run and activate policy', async () => {
      // Create active policy v1
      const v1 = await ctx.policyRepo.create(
        createTestPolicy({ allowedCountries: ['US'], allowedLanguages: ['en'] }),
      );
      await ctx.policyRepo.activate(v1.id);

      // Create new policy v2
      const v2 = await ctx.policyRepo.create(
        createTestPolicy({ allowedCountries: ['UA', 'US'], allowedLanguages: ['uk', 'en'] }),
      );

      // Create prepared run for v2
      const run = await ctx.runRepo.create({
        targetPolicyId: v2.id,
        targetPolicyVersion: v2.version,
        baselinePolicyVersion: v1.version,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.PREPARED });
      await ctx.runRepo.incrementCounters(run.id, {
        processed: 100,
        eligible: 80,
        ineligible: 20,
      });

      const res = await ctx.post(`/runs/${run.id}/promote`).expect(201);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('activated');

      // Verify policy is now active
      const activePolicy = await ctx.policyRepo.findActive();
      expect(activePolicy!.id).toBe(v2.id);

      // Verify run is marked as promoted
      const updatedRun = await ctx.runRepo.findById(run.id);
      expect(updatedRun!.status).toBe(RunStatus.PROMOTED);
      expect(updatedRun!.promotedAt).not.toBeNull();
    });
  });

  describe('POST /runs/:runId/cancel', () => {
    it('should return error when run not found', async () => {
      const res = await ctx.post('/runs/non-existent/cancel').expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error).toContain('not found');
    });

    it('should reject cancellation of non-cancellable run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      // Mark as promoted (terminal state, cannot cancel)
      await ctx.runRepo.update(run.id, { status: RunStatus.PROMOTED });

      const res = await ctx.post(`/runs/${run.id}/cancel`).expect(201);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error).toContain('can only cancel running');
    });

    it('should cancel running run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      const res = await ctx.post(`/runs/${run.id}/cancel`).expect(201);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('cancelled');

      // Verify run is cancelled
      const updatedRun = await ctx.runRepo.findById(run.id);
      expect(updatedRun!.status).toBe(RunStatus.CANCELLED);
    });

    it('should cancel prepared run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      // Mark as prepared (can still be cancelled)
      await ctx.runRepo.update(run.id, { status: RunStatus.PREPARED });

      const res = await ctx.post(`/runs/${run.id}/cancel`).expect(201);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('cancelled');

      // Verify run is cancelled
      const updatedRun = await ctx.runRepo.findById(run.id);
      expect(updatedRun!.status).toBe(RunStatus.CANCELLED);
    });
  });

  describe('GET /runs/:runId/diff', () => {
    it('should return 404 when run not found', async () => {
      const res = await ctx.get('/runs/non-existent/diff').expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should reject diff for running run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      const res = await ctx.get(`/runs/${run.id}/diff`).expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('running');
    });

    it('should return diff for successful run', async () => {
      // Create active policy v1
      const v1 = await ctx.policyRepo.create(
        createTestPolicy({ allowedCountries: ['US'], allowedLanguages: ['en'] }),
      );
      await ctx.policyRepo.activate(v1.id);

      // Create new policy v2
      const v2 = await ctx.policyRepo.create(
        createTestPolicy({ allowedCountries: ['UA', 'US'], allowedLanguages: ['uk', 'en'] }),
      );

      const run = await ctx.runRepo.create({
        targetPolicyId: v2.id,
        targetPolicyVersion: v2.version,
        baselinePolicyVersion: v1.version,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.PREPARED });

      // Setup mock DB results for diff computation
      // First, set execute results for computeCountsSQL
      ctx.mockDb._setExecuteResults([
        [
          {
            regressions: '1',
            improvements: '1',
            unchanged: '0',
            still_ineligible: '0',
          },
        ],
      ]);

      // Then set where results for getSampleItems
      ctx.mockDb._setWhereResults([
        // Old evals for regressions sample
        [
          { mediaItemId: 'item-1', status: 'eligible' },
          { mediaItemId: 'item-2', status: 'ineligible' },
        ],
        // New evals with join for regressions
        [{ mediaItemId: 'item-1', status: 'ineligible', title: 'Movie 1', trendingScore: 100 }],
        // Old evals for improvements sample
        [
          { mediaItemId: 'item-1', status: 'eligible' },
          { mediaItemId: 'item-2', status: 'ineligible' },
        ],
        // New evals with join for improvements
        [{ mediaItemId: 'item-2', status: 'eligible', title: 'Movie 2', trendingScore: 90 }],
      ]);

      const res = await ctx.get(`/runs/${run.id}/diff`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.runId).toBe(run.id);
      expect(res.body.data.targetPolicyVersion).toBe(v2.version);
      expect(res.body.data.currentPolicyVersion).toBe(v1.version);
      expect(res.body.data.counts).toBeDefined();
      expect(res.body.data.counts.regressions).toBe(1);
      expect(res.body.data.counts.improvements).toBe(1);
      expect(res.body.data.topRegressions).toHaveLength(1);
      expect(res.body.data.topImprovements).toHaveLength(1);
    });
  });

  /**
   * Feature: multi-context-evaluation
   * Property 4: Complete Context Coverage After Evaluation
   *
   * For any policy activation trigger, the system SHALL create RE_EVALUATE_ALL
   * jobs for ALL contexts in ACTIVE_EVALUATION_CONTEXTS.
   *
   * **Validates: Requirements 5.5**
   */
  describe('Property 4: Complete Context Coverage (Fan-Out)', () => {
    beforeEach(() => {
      ctx.queue.clear();
    });

    it('should create RE_EVALUATE_ALL jobs for all active contexts', async () => {
      // Arrange: Create a policy
      const policy = await ctx.policyRepo.create(createTestPolicy());

      // Act: Trigger policy preparation (which triggers fan-out)
      const res = await ctx.post(`/${policy.id}/prepare`).expect(202);

      expect(res.body.success).toBe(true);
      expect(res.body.data.runId).toBeDefined();

      // Assert: Verify jobs were created for all active contexts
      const reEvaluateAllJobs = ctx.queue.jobs.filter((j) => j.name === 're-evaluate-all');

      // Should have exactly ACTIVE_EVALUATION_CONTEXTS.length jobs
      expect(reEvaluateAllJobs.length).toBe(ACTIVE_EVALUATION_CONTEXTS.length);

      // Each active context should have exactly one job
      const dispatchedContexts = reEvaluateAllJobs.map((j) => j.data.context);

      for (const expectedContext of ACTIVE_EVALUATION_CONTEXTS) {
        const count = dispatchedContexts.filter((c) => c === expectedContext).length;
        expect(count).toBe(1);
      }

      // All dispatched contexts should be from ACTIVE_EVALUATION_CONTEXTS
      for (const context of dispatchedContexts) {
        expect(ACTIVE_EVALUATION_CONTEXTS).toContain(context);
      }
    });

    it('should include context in each RE_EVALUATE_ALL job payload', async () => {
      // Arrange
      const policy = await ctx.policyRepo.create(createTestPolicy());

      // Act
      await ctx.post(`/${policy.id}/prepare`).expect(202);

      // Assert: Each job should have context in payload
      const reEvaluateAllJobs = ctx.queue.jobs.filter((j) => j.name === 're-evaluate-all');

      for (const job of reEvaluateAllJobs) {
        expect(job.data.context).toBeDefined();
        expect(typeof job.data.context).toBe('string');
        expect(ACTIVE_EVALUATION_CONTEXTS).toContain(job.data.context);
      }
    });

    it('should include runId and policyVersion in each job payload', async () => {
      // Arrange
      const policy = await ctx.policyRepo.create(createTestPolicy());

      // Act
      const res = await ctx.post(`/${policy.id}/prepare`).expect(202);
      const runId = res.body.data.runId;

      // Assert: Each job should have consistent runId and policyVersion
      const reEvaluateAllJobs = ctx.queue.jobs.filter((j) => j.name === 're-evaluate-all');

      for (const job of reEvaluateAllJobs) {
        expect(job.data.runId).toBe(runId);
        expect(job.data.policyVersion).toBe(policy.version);
      }
    });

    it('should create unique job IDs per context', async () => {
      // Arrange
      const policy = await ctx.policyRepo.create(createTestPolicy());

      // Act
      await ctx.post(`/${policy.id}/prepare`).expect(202);

      // Assert: Job IDs should be unique and include context
      const reEvaluateAllJobs = ctx.queue.jobs.filter((j) => j.name === 're-evaluate-all');
      const jobIds = reEvaluateAllJobs.map((j) => j.opts?.jobId).filter(Boolean);

      // All job IDs should be unique
      const uniqueJobIds = new Set(jobIds);
      expect(uniqueJobIds.size).toBe(jobIds.length);

      // Each job ID should contain the context
      for (const job of reEvaluateAllJobs) {
        if (job.opts?.jobId) {
          expect(job.opts.jobId).toContain(job.data.context);
        }
      }
    });

    it('should fan-out for catalog and trending contexts specifically', async () => {
      // Arrange
      const policy = await ctx.policyRepo.create(createTestPolicy());

      // Act
      await ctx.post(`/${policy.id}/prepare`).expect(202);

      // Assert: Verify specific contexts are present
      const reEvaluateAllJobs = ctx.queue.jobs.filter((j) => j.name === 're-evaluate-all');
      const dispatchedContexts = reEvaluateAllJobs.map((j) => j.data.context);

      // Current ACTIVE_EVALUATION_CONTEXTS = ['catalog', 'trending']
      expect(dispatchedContexts).toContain('catalog');
      expect(dispatchedContexts).toContain('trending');
    });
  });
});
