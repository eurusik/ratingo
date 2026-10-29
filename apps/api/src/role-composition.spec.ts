import { type INestApplicationContext, type Type } from '@nestjs/common';
import { type EventEmitter2 } from '@nestjs/event-emitter';
import { type Test as NestTest } from '@nestjs/testing';

import { type AppRole } from './common/runtime/app-role';
import { CATALOG_POLICY_QUEUE } from './modules/catalog-policy/public';
import {
  BACKFILL_QUEUE,
  INGESTION_QUEUE,
  MediaSyncedEvent,
  RATINGS_BACKFILL_QUEUE,
} from './modules/ingestion/public';
import { STATS_QUEUE } from './modules/stats/public';
import { SHOW_EVENTS } from './modules/user-actions/public';
import {
  UserMediaRatingChangedEvent,
  UserMediaStateChangedEvent,
} from './modules/user-media/public';

const mockStartedWorkerQueues: string[] = [];

jest.mock('bullmq', () => {
  const actual = jest.requireActual('bullmq');

  class FakeQueue {
    readonly client = Promise.resolve({ set: async () => null });
    constructor(readonly name: string) {}
    getJobSchedulers = async () => [];
    upsertJobScheduler = async () => undefined;
    removeJobScheduler = async () => true;
    getRepeatableJobs = async () => [];
    removeRepeatableByKey = async () => true;
    add = async () => undefined;
    addBulk = async () => [];
    on = () => this;
    close = async () => undefined;
  }

  class FakeWorker {
    constructor(readonly name: string) {
      mockStartedWorkerQueues.push(name);
    }
    on = () => this;
    close = async () => undefined;
  }

  return { ...actual, Queue: FakeQueue, Worker: FakeWorker, FlowProducer: FakeQueue };
});

const REQUIRED_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/postgres',
  TMDB_API_KEY: 'dummy',
  TRAKT_CLIENT_ID: 'dummy',
  TRAKT_CLIENT_SECRET: 'dummy',
  OMDB_API_KEY: 'dummy',
};

const JWT_SECRETS = {
  ACCESS_TOKEN_SECRET: 'role-composition-access-token-secret',
  REFRESH_TOKEN_SECRET: 'role-composition-refresh-token-secret',
};

const ROLE_ENV_KEYS = ['APP_ROLE', ...Object.keys(REQUIRED_ENV), ...Object.keys(JWT_SECRETS)];

const WORKER_QUEUES = [
  INGESTION_QUEUE,
  BACKFILL_QUEUE,
  RATINGS_BACKFILL_QUEUE,
  CATALOG_POLICY_QUEUE,
  STATS_QUEUE,
];

interface RoleBoot {
  app: INestApplicationContext;
  load: <T = Type<unknown>>(path: string, exportName: string) => T;
  emitter: () => EventEmitter2;
}

const fakeRedis = { defineCommand: () => undefined, quit: async () => 'OK', on: () => undefined };
const fakePostgres = { end: async () => undefined };

const WORKER_PROVIDERS: Array<[string, string]> = [
  ['./modules/ingestion/application/workers/sync.worker', 'SyncWorker'],
  ['./modules/ingestion/application/workers/backfill.worker', 'BackfillWorker'],
  ['./modules/ingestion/application/workers/ratings-backfill.worker', 'RatingsBackfillWorker'],
  ['./modules/catalog-policy/application/workers/catalog-policy.worker', 'CatalogPolicyWorker'],
  ['./modules/stats/application/workers/stats.worker', 'StatsWorker'],
  [
    './modules/ingestion/application/services/ingestion-scheduler.service',
    'IngestionSchedulerService',
  ],
  ['./modules/catalog-policy/application/workers/handlers/watchdog.handler', 'WatchdogHandler'],
];

const GATED_CONTROLLERS: Array<[string, string]> = [
  ['./modules/ingestion/presentation/controllers/ingestion.controller', 'IngestionController'],
  ['./modules/catalog-policy/presentation/controllers', 'PolicyController'],
  ['./modules/catalog-policy/presentation/controllers', 'RunController'],
  ['./modules/catalog-policy/presentation/controllers', 'DryRunController'],
  ['./modules/stats/presentation/controllers/stats.controller', 'StatsController'],
];

const AUTH_MODULE: [string, string] = ['./modules/auth/auth.module', 'AuthModule'];
const AUTH_CLEANUP_CRON: [string, string] = [
  './modules/auth/infrastructure/jobs/cleanup-exchange-codes.job',
  'CleanupExchangeCodesJob',
];

const APP_MODULE = { path: './app.module', exportName: 'AppModule' };
const WORKER_APP_MODULE = { path: './worker-app.module', exportName: 'WorkerAppModule' };

const DATABASE_MODULE_PATH = './database/database.module';
const COOLDOWN_GATE_PATH = './modules/catalog/infrastructure/adapters/redis-cooldown-gate.adapter';

const ISOLATED_PATHS = [
  '@nestjs/testing',
  '@nestjs/event-emitter',
  DATABASE_MODULE_PATH,
  COOLDOWN_GATE_PATH,
  APP_MODULE.path,
  WORKER_APP_MODULE.path,
  AUTH_MODULE[0],
  AUTH_CLEANUP_CRON[0],
  ...[...WORKER_PROVIDERS, ...GATED_CONTROLLERS].map(([path]) => path),
];

async function bootRole(
  role: AppRole,
  rootModule: { path: string; exportName: string },
  env: Record<string, string>,
): Promise<RoleBoot> {
  ROLE_ENV_KEYS.forEach((key) => delete process.env[key]);
  Object.assign(process.env, env, { APP_ROLE: role });
  mockStartedWorkerQueues.length = 0;

  const isolated = new Map<string, Record<string, unknown>>();
  jest.isolateModules(() => {
    ISOLATED_PATHS.forEach((path) => isolated.set(path, jest.requireActual(path)));
  });
  const load = <T = Type<unknown>>(path: string, exportName: string): T =>
    isolated.get(path)[exportName] as T;
  const Test = load<typeof NestTest>('@nestjs/testing', 'Test');
  const root = load(rootModule.path, rootModule.exportName);
  const tokens = {
    postgres: load<symbol>(DATABASE_MODULE_PATH, 'POSTGRES_CLIENT'),
    database: load<string>(DATABASE_MODULE_PATH, 'DATABASE_CONNECTION'),
    redis: load<symbol>(COOLDOWN_GATE_PATH, 'COOLDOWN_REDIS_CLIENT'),
  };

  const moduleRef = await Test.createTestingModule({ imports: [root] })
    .overrideProvider(tokens.postgres)
    .useValue(fakePostgres)
    .overrideProvider(tokens.database)
    .useValue({})
    .overrideProvider(tokens.redis)
    .useValue(fakeRedis)
    .compile();

  const app = await moduleRef.init();
  const emitterToken = load<Type<EventEmitter2>>('@nestjs/event-emitter', 'EventEmitter2');
  return { app, load, emitter: () => app.get(emitterToken) };
}

const isRegistered = (boot: RoleBoot, path: string, exportName: string): boolean => {
  const token = boot.load(path, exportName);
  if (!token) {
    throw new Error(`${path} no longer exports ${exportName}; update the role composition spec`);
  }
  try {
    boot.app.get(token, { strict: false });
    return true;
  } catch {
    return false;
  }
};

describe('role composition', () => {
  const originalEnv = { ...process.env };
  let boot: RoleBoot | undefined;

  const closeBoot = async () => {
    await boot?.app.close();
    boot = undefined;
    process.env = { ...originalEnv };
  };

  describe('APP_ROLE=worker (WorkerAppModule, no JWT secrets)', () => {
    beforeAll(async () => {
      boot = await bootRole('worker', WORKER_APP_MODULE, REQUIRED_ENV);
    });
    afterAll(closeBoot);

    it('boots without AuthModule or its cleanup cron in the graph', () => {
      expect(isRegistered(boot, ...AUTH_MODULE)).toBe(false);
      expect(isRegistered(boot, ...AUTH_CLEANUP_CRON)).toBe(false);
    });

    it.each(WORKER_PROVIDERS)('registers %s#%s', (path, name) => {
      expect(isRegistered(boot, path, name)).toBe(true);
    });

    it.each(GATED_CONTROLLERS)('does not register %s#%s', (path, name) => {
      expect(isRegistered(boot, path, name)).toBe(false);
    });

    it('starts a BullMQ worker for every processor', () => {
      expect(mockStartedWorkerQueues).toEqual(expect.arrayContaining(WORKER_QUEUES));
    });

    it('keeps the in-process listeners for events the worker emits', () => {
      const emitter = boot.emitter();
      expect(emitter.listenerCount(MediaSyncedEvent.eventName)).toBeGreaterThan(0);
      expect(emitter.listenerCount(SHOW_EVENTS.NEW_EPISODE)).toBeGreaterThan(0);
    });
  });

  describe('APP_ROLE=api (AppModule)', () => {
    beforeAll(async () => {
      boot = await bootRole('api', APP_MODULE, { ...REQUIRED_ENV, ...JWT_SECRETS });
    });
    afterAll(closeBoot);

    it.each(WORKER_PROVIDERS)('does not register %s#%s', (path, name) => {
      expect(isRegistered(boot, path, name)).toBe(false);
    });

    it.each(GATED_CONTROLLERS)('registers %s#%s', (path, name) => {
      expect(isRegistered(boot, path, name)).toBe(true);
    });

    it('owns AuthModule and the exchange-code cleanup cron', () => {
      expect(isRegistered(boot, ...AUTH_MODULE)).toBe(true);
      expect(isRegistered(boot, ...AUTH_CLEANUP_CRON)).toBe(true);
    });

    it('starts no BullMQ workers', () => {
      expect(mockStartedWorkerQueues).toEqual([]);
    });

    it('keeps the in-process listeners for events the API emits', () => {
      const emitter = boot.emitter();
      expect(emitter.listenerCount(UserMediaRatingChangedEvent.eventName)).toBeGreaterThan(0);
      expect(emitter.listenerCount(UserMediaStateChangedEvent.eventName)).toBeGreaterThan(0);
    });
  });

  describe('APP_ROLE=all (AppModule, today’s single process)', () => {
    beforeAll(async () => {
      boot = await bootRole('all', APP_MODULE, { ...REQUIRED_ENV, ...JWT_SECRETS });
    });
    afterAll(closeBoot);

    it.each([...WORKER_PROVIDERS, ...GATED_CONTROLLERS])('registers %s#%s', (path, name) => {
      expect(isRegistered(boot, path, name)).toBe(true);
    });

    it('starts the same BullMQ workers as the worker role', () => {
      expect(mockStartedWorkerQueues).toEqual(expect.arrayContaining(WORKER_QUEUES));
    });

    it('keeps every in-process listener', () => {
      const emitter = boot.emitter();
      expect(emitter.listenerCount(MediaSyncedEvent.eventName)).toBeGreaterThan(0);
      expect(emitter.listenerCount(SHOW_EVENTS.NEW_EPISODE)).toBeGreaterThan(0);
      expect(emitter.listenerCount(UserMediaRatingChangedEvent.eventName)).toBeGreaterThan(0);
      expect(emitter.listenerCount(UserMediaStateChangedEvent.eventName)).toBeGreaterThan(0);
    });
  });
});
