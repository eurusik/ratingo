/**
 * Catalog Policy E2E Test Harness
 *
 * Provides in-memory implementations of repositories and queue
 * for testing the policy activation flow without real database/Redis.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import * as request from 'supertest';

import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

import { PolicyActivationController } from '../../src/modules/catalog-policy/presentation/controllers/policy-activation.controller';
import { PolicyActivationService } from '../../src/modules/catalog-policy/application/services/policy-activation.service';
import { DiffService } from '../../src/modules/catalog-policy/application/services/diff.service';
import { CATALOG_POLICY_QUEUE } from '../../src/modules/catalog-policy/catalog-policy.constants';
import {
  ICatalogPolicyRepository,
  CATALOG_POLICY_REPOSITORY,
} from '../../src/modules/catalog-policy/infrastructure/repositories/catalog-policy.repository';
import {
  ICatalogEvaluationRunRepository,
  CATALOG_EVALUATION_RUN_REPOSITORY,
  CatalogEvaluationRun,
  CreateRunInput,
  UpdateRunInput,
  IncrementCountersInput,
} from '../../src/modules/catalog-policy/infrastructure/repositories/catalog-evaluation-run.repository';
import {
  IMediaCatalogEvaluationRepository,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
} from '../../src/modules/catalog-policy/infrastructure/repositories/media-catalog-evaluation.repository';
import { DATABASE_CONNECTION } from '../../src/database/database.module';
import {
  CatalogPolicy,
  PolicyConfig,
  MediaCatalogEvaluation,
  EligibilityStatus,
} from '../../src/modules/catalog-policy/domain/types/policy.types';
import {
  RunStatus,
  RunStatusType,
} from '../../src/modules/catalog-policy/domain/constants/evaluation.constants';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a minimal valid PolicyConfig for testing
 */
export function createTestPolicy(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return {
    allowedCountries: ['UA'],
    blockedCountries: [],
    blockedCountryMode: 'ANY',
    allowedLanguages: ['uk'],
    blockedLanguages: [],
    globalProviders: [],
    breakoutRules: [],
    eligibilityMode: 'STRICT',
    homepage: { minRelevanceScore: 0 },
    ...overrides,
  };
}

// ============================================================================
// In-Memory Policy Repository
// ============================================================================

class InMemoryPolicyRepository implements ICatalogPolicyRepository {
  private policies: CatalogPolicy[] = [];

  async findActive(): Promise<CatalogPolicy | null> {
    return this.policies.find((p) => p.isActive) ?? null;
  }

  async findById(id: string): Promise<CatalogPolicy | null> {
    return this.policies.find((p) => p.id === id) ?? null;
  }

  async findByVersion(version: number): Promise<CatalogPolicy | null> {
    return this.policies.find((p) => p.version === version) ?? null;
  }

  async create(policy: PolicyConfig): Promise<CatalogPolicy> {
    const maxVersion = Math.max(0, ...this.policies.map((p) => p.version));
    const newPolicy: CatalogPolicy = {
      id: `policy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      version: maxVersion + 1,
      isActive: false,
      policy,
      createdAt: new Date(),
      activatedAt: null,
    };
    this.policies.push(newPolicy);
    return newPolicy;
  }

  async activate(id: string): Promise<void> {
    this.policies.forEach((p) => {
      p.isActive = p.id === id;
      if (p.id === id) p.activatedAt = new Date();
    });
  }

  async findAll(): Promise<CatalogPolicy[]> {
    return [...this.policies].sort((a, b) => b.version - a.version);
  }

  // Test helper
  clear(): void {
    this.policies = [];
  }
}

// ============================================================================
// In-Memory Run Repository
// ============================================================================

class InMemoryRunRepository implements ICatalogEvaluationRunRepository {
  private runs: CatalogEvaluationRun[] = [];

  async create(input: CreateRunInput): Promise<CatalogEvaluationRun> {
    const run: CatalogEvaluationRun = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      policyVersion: input.targetPolicyVersion,
      status: RunStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      cursor: null,
      targetPolicyId: input.targetPolicyId,
      targetPolicyVersion: input.targetPolicyVersion,
      totalReadySnapshot: input.totalReadySnapshot,
      snapshotCutoff: input.snapshotCutoff,
      processed: 0,
      eligible: 0,
      ineligible: 0,
      pending: 0,
      errors: 0,
      errorSample: [],
      promotedAt: null,
      promotedBy: null,
    };
    this.runs.push(run);
    return run;
  }

  async findById(id: string): Promise<CatalogEvaluationRun | null> {
    return this.runs.find((r) => r.id === id) ?? null;
  }

  async update(id: string, updates: UpdateRunInput): Promise<void> {
    const run = this.runs.find((r) => r.id === id);
    if (run) {
      Object.assign(run, updates);
    }
  }

  async incrementCounters(id: string, increments: IncrementCountersInput): Promise<void> {
    const run = this.runs.find((r) => r.id === id);
    if (run) {
      if (increments.processed) run.processed += increments.processed;
      if (increments.eligible) run.eligible += increments.eligible;
      if (increments.ineligible) run.ineligible += increments.ineligible;
      if (increments.pending) run.pending += increments.pending;
      if (increments.errors) run.errors += increments.errors;
    }
  }

  async appendError(
    id: string,
    error: { mediaItemId: string; error: string; stack?: string; timestamp: string },
  ): Promise<void> {
    const run = this.runs.find((r) => r.id === id);
    if (run) {
      run.errorSample = [error, ...run.errorSample].slice(0, 10);
    }
  }

  async recordError(
    id: string,
    error: { mediaItemId: string; error: string; stack?: string; timestamp: string },
  ): Promise<void> {
    const run = this.runs.find((r) => r.id === id);
    if (run) {
      run.errors += 1;
      run.errorSample = [error, ...run.errorSample].slice(0, 10);
    }
  }

  async findByPolicyId(policyId: string): Promise<CatalogEvaluationRun[]> {
    return this.runs.filter((r) => r.targetPolicyId === policyId);
  }

  async findByStatus(status: string): Promise<CatalogEvaluationRun[]> {
    return this.runs.filter((r) => r.status === status);
  }

  // Test helper
  clear(): void {
    this.runs = [];
  }
}

// ============================================================================
// In-Memory Evaluation Repository
// ============================================================================

class InMemoryEvaluationRepository implements IMediaCatalogEvaluationRepository {
  private evaluations: MediaCatalogEvaluation[] = [];

  async upsert(evaluation: MediaCatalogEvaluation): Promise<MediaCatalogEvaluation> {
    const idx = this.evaluations.findIndex(
      (e) =>
        e.mediaItemId === evaluation.mediaItemId && e.policyVersion === evaluation.policyVersion,
    );
    if (idx >= 0) {
      this.evaluations[idx] = evaluation;
    } else {
      this.evaluations.push(evaluation);
    }
    return evaluation;
  }

  async bulkUpsert(evaluations: MediaCatalogEvaluation[]): Promise<number> {
    for (const e of evaluations) {
      await this.upsert(e);
    }
    return evaluations.length;
  }

  async findByMediaId(mediaItemId: string): Promise<MediaCatalogEvaluation | null> {
    return this.evaluations.find((e) => e.mediaItemId === mediaItemId) ?? null;
  }

  async findByMediaIdAndPolicyVersion(
    mediaItemId: string,
    policyVersion: number,
  ): Promise<MediaCatalogEvaluation | null> {
    return (
      this.evaluations.find(
        (e) => e.mediaItemId === mediaItemId && e.policyVersion === policyVersion,
      ) ?? null
    );
  }

  async listByPolicyVersion(
    policyVersion: number,
    options?: { limit?: number; offset?: number },
  ): Promise<MediaCatalogEvaluation[]> {
    let result = this.evaluations.filter((e) => e.policyVersion === policyVersion);
    if (options?.offset) result = result.slice(options.offset);
    if (options?.limit) result = result.slice(0, options.limit);
    return result;
  }

  async findByStatus(
    status: EligibilityStatus,
    options?: { limit?: number; offset?: number },
  ): Promise<MediaCatalogEvaluation[]> {
    let result = this.evaluations.filter((e) => e.status === status);
    if (options?.offset) result = result.slice(options.offset);
    if (options?.limit) result = result.slice(0, options.limit);
    return result;
  }

  async countByStatusAndPolicyVersion(
    policyVersion: number,
  ): Promise<Record<EligibilityStatus, number>> {
    const counts: Record<EligibilityStatus, number> = {
      PENDING: 0,
      ELIGIBLE: 0,
      INELIGIBLE: 0,
      REVIEW: 0,
    };
    for (const e of this.evaluations) {
      if (e.policyVersion === policyVersion) {
        counts[e.status]++;
      }
    }
    return counts;
  }

  // Test helper
  clear(): void {
    this.evaluations = [];
  }
}

// ============================================================================
// Mock Queue
// ============================================================================

class MockQueue {
  jobs: Array<{ name: string; data: any; opts?: any }> = [];

  async add(name: string, data: any, opts?: any) {
    this.jobs.push({ name, data, opts });
    return { id: `job-${this.jobs.length}`, name, data };
  }

  async getJobCounts() {
    return { waiting: 0, active: 0, completed: this.jobs.length, failed: 0 };
  }

  clear() {
    this.jobs = [];
  }
}

// ============================================================================
// Mock DB for DiffService
// ============================================================================

function createMockDb() {
  let whereResults: any[] = [];
  let whereCallIndex = 0;

  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation(() => {
      const result = whereResults[whereCallIndex] ?? [];
      whereCallIndex++;
      return Promise.resolve(result);
    }),
    limit: jest.fn().mockResolvedValue([]),
    // Helper to set results for tests
    _setWhereResults(results: any[]) {
      whereResults = results;
      whereCallIndex = 0;
    },
    _reset() {
      whereResults = [];
      whereCallIndex = 0;
    },
  };
}

// ============================================================================
// Test Context
// ============================================================================

export interface CatalogPolicyE2eContext {
  app: INestApplication;
  policyRepo: InMemoryPolicyRepository;
  runRepo: InMemoryRunRepository;
  evaluationRepo: InMemoryEvaluationRepository;
  queue: MockQueue;
  mockDb: ReturnType<typeof createMockDb>;
  post: (path: string, body?: any) => request.Test;
  get: (path: string) => request.Test;
  close: () => Promise<void>;
}

export async function createCatalogPolicyApp(): Promise<CatalogPolicyE2eContext> {
  const policyRepo = new InMemoryPolicyRepository();
  const runRepo = new InMemoryRunRepository();
  const evaluationRepo = new InMemoryEvaluationRepository();
  const queue = new MockQueue();
  const mockDb = createMockDb();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    controllers: [PolicyActivationController],
    providers: [
      PolicyActivationService,
      DiffService,
      { provide: CATALOG_POLICY_REPOSITORY, useValue: policyRepo },
      { provide: CATALOG_EVALUATION_RUN_REPOSITORY, useValue: runRepo },
      { provide: MEDIA_CATALOG_EVALUATION_REPOSITORY, useValue: evaluationRepo },
      { provide: getQueueToken(CATALOG_POLICY_QUEUE), useValue: queue },
      { provide: DATABASE_CONNECTION, useValue: mockDb },
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
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

  const baseUrl = '/api/admin/catalog-policies';

  return {
    app,
    policyRepo,
    runRepo,
    evaluationRepo,
    queue,
    mockDb,
    post: (path: string, body?: any) => {
      const req = request(app.getHttpServer()).post(`${baseUrl}${path}`);
      if (body !== undefined) {
        return req.send(body);
      }
      return req.send({});
    },
    get: (path: string) => request(app.getHttpServer()).get(`${baseUrl}${path}`),
    close: () => app.close(),
  };
}
