/**
 * Policy Activation E2E Tests
 *
 * Tests the full policy activation flow: Prepare → Poll → Diff → Promote/Cancel
 */

import { createCatalogPolicyApp, CatalogPolicyE2eContext, createTestPolicy } from './_harness';
import { RunStatus } from '../../src/modules/catalog-policy/domain/constants/evaluation.constants';

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
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      // Simulate some progress
      await ctx.runRepo.incrementCounters(run.id, {
        processed: 50,
        eligible: 30,
        ineligible: 15,
        pending: 5,
      });

      const res = await ctx.get(`/runs/${run.id}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(run.id);
      expect(res.body.data.status).toBe('running');
      expect(res.body.data.progress.total).toBe(100);
      expect(res.body.data.progress.processed).toBe(50);
      expect(res.body.data.progress.eligible).toBe(30);
      expect(res.body.data.progress.ineligible).toBe(15);
      expect(res.body.data.progress.pending).toBe(5);
      expect(res.body.data.coverage).toBe(0.5); // 50/100
    });

    it('should show readyToPromote when run is prepared', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
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
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.PREPARED });

      // Setup mock DB results for diff computation
      ctx.mockDb._setWhereResults([
        // Old evals (v1)
        [
          { mediaItemId: 'item-1', status: 'eligible' },
          { mediaItemId: 'item-2', status: 'ineligible' },
        ],
        // New evals (v2)
        [
          { mediaItemId: 'item-1', status: 'ineligible' }, // regression
          { mediaItemId: 'item-2', status: 'eligible' }, // improvement
        ],
        // Old evals for regressions sample
        [
          { mediaItemId: 'item-1', status: 'eligible' },
          { mediaItemId: 'item-2', status: 'ineligible' },
        ],
        // New evals with join for regressions
        [
          { mediaItemId: 'item-1', status: 'ineligible', title: 'Movie 1', trendingScore: 100 },
          { mediaItemId: 'item-2', status: 'eligible', title: 'Movie 2', trendingScore: 90 },
        ],
        // Old evals for improvements sample
        [
          { mediaItemId: 'item-1', status: 'eligible' },
          { mediaItemId: 'item-2', status: 'ineligible' },
        ],
        // New evals with join for improvements
        [
          { mediaItemId: 'item-1', status: 'ineligible', title: 'Movie 1', trendingScore: 100 },
          { mediaItemId: 'item-2', status: 'eligible', title: 'Movie 2', trendingScore: 90 },
        ],
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
});
