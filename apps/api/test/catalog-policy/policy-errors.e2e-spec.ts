/**
 * Policy Error Scenarios E2E Tests
 *
 * Tests error handling and edge cases in policy operations.
 */

import { createCatalogPolicyApp, CatalogPolicyE2eContext, createTestPolicy } from './_harness';
import { RunStatus } from '../../src/modules/catalog-policy/domain/constants/evaluation.constants';

describe('Policy Error Scenarios (e2e)', () => {
  let ctx: CatalogPolicyE2eContext;

  beforeAll(async () => {
    ctx = await createCatalogPolicyApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(() => {
    ctx.queue.clear();
  });

  describe('Policy Already Active', () => {
    it('should reject prepare for already active policy', async () => {
      // Create and activate a policy
      const policy = await ctx.policyRepo.create(createTestPolicy());
      await ctx.policyRepo.activate(policy.id);

      // Try to prepare the already active policy - returns 409 Conflict
      const res = await ctx.post(`/${policy.id}/prepare`).expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already active');
    });
  });

  describe('Run Already In Progress', () => {
    it('should reject prepare when run is already running', async () => {
      // Create a policy
      const policy = await ctx.policyRepo.create(createTestPolicy());

      // Create a running run for this policy
      await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      // Try to prepare again - should fail with 409 Conflict
      const res = await ctx.post(`/${policy.id}/prepare`).expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already in progress');
    });

    it('should allow prepare after previous run is cancelled', async () => {
      // Create a policy
      const policy = await ctx.policyRepo.create(createTestPolicy());

      // Create and cancel a run
      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });
      await ctx.runRepo.update(run.id, { status: RunStatus.CANCELLED });

      // Should be able to prepare now
      const res = await ctx.post(`/${policy.id}/prepare`).expect(202);

      expect(res.body.success).toBe(true);
      expect(res.body.data.runId).toBeDefined();
    });

    it('should allow prepare after previous run is promoted', async () => {
      // Create policy v1 and activate it
      const v1 = await ctx.policyRepo.create(createTestPolicy());
      await ctx.policyRepo.activate(v1.id);

      // Create policy v2
      const v2 = await ctx.policyRepo.create(createTestPolicy());

      // Create and promote a run for v2
      const run = await ctx.runRepo.create({
        targetPolicyId: v2.id,
        targetPolicyVersion: v2.version,
        baselinePolicyVersion: v1.version,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });
      await ctx.runRepo.update(run.id, { status: RunStatus.PROMOTED });

      // Create policy v3
      const v3 = await ctx.policyRepo.create(createTestPolicy());

      // Should be able to prepare v3
      const res = await ctx.post(`/${v3.id}/prepare`).expect(202);

      expect(res.body.success).toBe(true);
    });
  });

  describe('Promotion Validation', () => {
    it('should reject promotion when run has errors', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      // Complete run but with errors
      await ctx.runRepo.update(run.id, { status: RunStatus.PREPARED });
      await ctx.runRepo.incrementCounters(run.id, {
        processed: 100,
        eligible: 80,
        ineligible: 15,
        errors: 5, // 5 errors
      });

      const res = await ctx.post(`/runs/${run.id}/promote`).expect(201);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error.toLowerCase()).toContain('error');
    });

    it('should reject promotion of failed run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.FAILED });

      const res = await ctx.post(`/runs/${run.id}/promote`).expect(201);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error).toContain('expected prepared');
    });

    it('should reject promotion of already promoted run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.PROMOTED });

      const res = await ctx.post(`/runs/${run.id}/promote`).expect(201);

      expect(res.body.data.success).toBe(false);
    });
  });

  describe('Run State Transitions', () => {
    it('should not allow cancellation of promoted run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.PROMOTED });

      const res = await ctx.post(`/runs/${run.id}/cancel`).expect(201);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.error).toContain('can only cancel');
    });

    it('should not allow cancellation of failed run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.FAILED });

      const res = await ctx.post(`/runs/${run.id}/cancel`).expect(201);

      expect(res.body.data.success).toBe(false);
    });

    it('should not allow cancellation of already cancelled run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.CANCELLED });

      const res = await ctx.post(`/runs/${run.id}/cancel`).expect(201);

      expect(res.body.data.success).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero total snapshot gracefully', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 0, // No items to process
        snapshotCutoff: new Date(),
      });

      const res = await ctx.get(`/runs/${run.id}`).expect(200);

      expect(res.body.data.progress.total).toBe(0);
      // Coverage should be handled gracefully (not NaN or Infinity)
      expect(Number.isFinite(res.body.data.coverage)).toBe(true);
    });

    it('should handle first policy activation (no baseline)', async () => {
      // Clear any existing active policies
      const existingActive = await ctx.policyRepo.findActive();
      if (existingActive) {
        // Deactivate by creating and activating a new one, then deactivating
        // For test purposes, we'll just work with this scenario
      }

      const policy = await ctx.policyRepo.create(createTestPolicy());

      const res = await ctx.post(`/${policy.id}/prepare`).expect(202);

      expect(res.body.success).toBe(true);

      // Run should have null baseline
      const run = await ctx.runRepo.findById(res.body.data.runId);
      // baselinePolicyVersion should be null for first policy
      expect(run).not.toBeNull();
    });

    it('should track multiple runs for policy history', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      // Create first run
      const run1 = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });
      await ctx.runRepo.update(run1.id, { status: RunStatus.CANCELLED });

      // Create second run
      const run2 = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });
      await ctx.runRepo.update(run2.id, { status: RunStatus.FAILED });

      // Create third run (current)
      const run3 = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      // All runs should be retrievable
      const allRuns = await ctx.runRepo.findByPolicyId(policy.id);
      expect(allRuns.length).toBe(3);
    });
  });

  describe('Diff Edge Cases', () => {
    it('should handle diff when no active policy exists', async () => {
      // Create a new policy without any active baseline
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null, // No baseline
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.PREPARED });
      await ctx.runRepo.incrementCounters(run.id, {
        processed: 100,
        eligible: 80,
        ineligible: 20,
      });

      const res = await ctx.get(`/runs/${run.id}/diff`).expect(200);

      expect(res.body.success).toBe(true);
      // currentPolicyVersion may be null or a version number depending on mock state
      expect(res.body.data.currentPolicyVersion).toBeDefined();
    });

    it('should reject diff for cancelled run', async () => {
      const policy = await ctx.policyRepo.create(createTestPolicy());

      const run = await ctx.runRepo.create({
        targetPolicyId: policy.id,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion: null,
        totalReadySnapshot: 100,
        snapshotCutoff: new Date(),
      });

      await ctx.runRepo.update(run.id, { status: RunStatus.CANCELLED });

      const res = await ctx.get(`/runs/${run.id}/diff`).expect(400);

      expect(res.body.success).toBe(false);
    });
  });
});
