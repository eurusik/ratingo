import { type INestApplicationContext, type Type } from '@nestjs/common';
import { type DiscoveryService, type ModulesContainer } from '@nestjs/core';
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

jest.mock('ioredis', () => {
  class FakeRedis {
    defineCommand = () => undefined;
    on = () => this;
    quit = async () => 'OK';
    disconnect = () => undefined;
  }
  return { __esModule: true, default: FakeRedis, Redis: FakeRedis };
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

const WORKER_PROVIDERS = [
  'SyncWorker',
  'BackfillWorker',
  'RatingsBackfillWorker',
  'CatalogPolicyWorker',
  'StatsWorker',
  'IngestionSchedulerService',
  'WatchdogHandler',
  'LinkPendingImportsScheduler',
  'QueueJobMetricsService',
];

const EVERY_ROLE_PROVIDERS = ['RuntimeMetricsService'];

const GATED_CONTROLLERS = [
  'IngestionController',
  'PolicyController',
  'RunController',
  'DryRunController',
  'StatsController',
  'CatalogMoviesController',
  'ProvidersController',
  'NotificationsController',
  'UserMediaController',
];

const API_ONLY_PROVIDERS = ['CleanupExchangeCodesJob'];
const API_ONLY_MODULES = ['AuthModule', 'ThrottlerModule'];

const APP_MODULE = { path: './app.module', exportName: 'AppModule' };
const WORKER_APP_MODULE = { path: './worker-app.module', exportName: 'WorkerAppModule' };
const DATABASE_MODULE_PATH = './database/database.module';

const ISOLATED_PATHS = [
  '@nestjs/testing',
  '@nestjs/core',
  '@nestjs/event-emitter',
  DATABASE_MODULE_PATH,
  APP_MODULE.path,
  WORKER_APP_MODULE.path,
];

interface Composition {
  modules: string[];
  providers: string[];
  controllers: string[];
}

interface RoleBoot {
  app: INestApplicationContext;
  composition: Composition;
  emitter: EventEmitter2;
}

const fakePostgres = { end: async () => undefined };

type Loader = <T>(path: string, exportName: string) => T;

function applyRoleEnv(role: AppRole, env: Record<string, string>): void {
  ROLE_ENV_KEYS.forEach((key) => delete process.env[key]);
  Object.assign(process.env, env, { APP_ROLE: role });
  mockStartedWorkerQueues.length = 0;
}

function loadIsolated(): Loader {
  const isolated = new Map<string, Record<string, unknown>>();
  jest.isolateModules(() => {
    ISOLATED_PATHS.forEach((path) => isolated.set(path, jest.requireActual(path)));
  });
  return <T>(path: string, exportName: string) => isolated.get(path)[exportName] as T;
}

async function bootModule(
  load: Loader,
  rootModule: { path: string; exportName: string },
): Promise<INestApplicationContext> {
  const Test = load<typeof NestTest>('@nestjs/testing', 'Test');
  const moduleRef = await Test.createTestingModule({
    imports: [load<Type<unknown>>(rootModule.path, rootModule.exportName)],
  })
    .overrideProvider(load<symbol>(DATABASE_MODULE_PATH, 'POSTGRES_CLIENT'))
    .useValue(fakePostgres)
    .overrideProvider(load<string>(DATABASE_MODULE_PATH, 'DATABASE_CONNECTION'))
    .useValue({})
    .compile();
  return moduleRef.init();
}

function snapshotComposition(app: INestApplicationContext, load: Loader): Composition {
  const discovery = app.get(load<Type<DiscoveryService>>('@nestjs/core', 'DiscoveryService'), {
    strict: false,
  });
  const modulesContainer = app.get(
    load<Type<ModulesContainer>>('@nestjs/core', 'ModulesContainer'),
  );
  return {
    modules: [...modulesContainer.values()].map((module) => module.metatype?.name),
    providers: discovery.getProviders().map((wrapper) => wrapper.name),
    controllers: discovery.getControllers().map((wrapper) => wrapper.name),
  };
}

async function bootRole(
  role: AppRole,
  rootModule: { path: string; exportName: string },
  env: Record<string, string>,
): Promise<RoleBoot> {
  applyRoleEnv(role, env);
  const load = loadIsolated();
  const app = await bootModule(load, rootModule);
  return {
    app,
    composition: snapshotComposition(app, load),
    emitter: app.get(load<Type<EventEmitter2>>('@nestjs/event-emitter', 'EventEmitter2')),
  };
}

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

    it('registers every processor, repeatable-job scheduler and job metric', () => {
      expect(boot.composition.providers).toEqual(
        expect.arrayContaining([...WORKER_PROVIDERS, ...EVERY_ROLE_PROVIDERS]),
      );
    });

    it('registers no HTTP controllers at all', () => {
      expect(boot.composition.controllers).toEqual([]);
    });

    it('leaves AuthModule, Throttler and the exchange-code cleanup cron to the API', () => {
      API_ONLY_MODULES.forEach((name) => expect(boot.composition.modules).not.toContain(name));
      API_ONLY_PROVIDERS.forEach((name) => expect(boot.composition.providers).not.toContain(name));
    });

    it('starts a BullMQ worker for every processor', () => {
      expect(mockStartedWorkerQueues).toEqual(expect.arrayContaining(WORKER_QUEUES));
    });

    it('keeps the in-process listeners for events the worker emits', () => {
      expect(boot.emitter.listenerCount(MediaSyncedEvent.eventName)).toBeGreaterThan(0);
      expect(boot.emitter.listenerCount(SHOW_EVENTS.NEW_EPISODE)).toBeGreaterThan(0);
    });
  });

  describe('APP_ROLE=api (AppModule)', () => {
    beforeAll(async () => {
      boot = await bootRole('api', APP_MODULE, { ...REQUIRED_ENV, ...JWT_SECRETS });
    });
    afterAll(closeBoot);

    it('registers no processor, repeatable-job scheduler or job metric', () => {
      WORKER_PROVIDERS.forEach((name) => expect(boot.composition.providers).not.toContain(name));
    });

    it('still reports runtime metrics', () => {
      expect(boot.composition.providers).toEqual(expect.arrayContaining(EVERY_ROLE_PROVIDERS));
    });

    it('registers the role-gated controllers', () => {
      expect(boot.composition.controllers).toEqual(expect.arrayContaining(GATED_CONTROLLERS));
    });

    it('owns AuthModule, Throttler and the exchange-code cleanup cron', () => {
      expect(boot.composition.modules).toEqual(expect.arrayContaining(API_ONLY_MODULES));
      expect(boot.composition.providers).toEqual(expect.arrayContaining(API_ONLY_PROVIDERS));
    });

    it('starts no BullMQ workers', () => {
      expect(mockStartedWorkerQueues).toEqual([]);
    });

    it('keeps the in-process listeners for events the API emits', () => {
      expect(boot.emitter.listenerCount(UserMediaRatingChangedEvent.eventName)).toBeGreaterThan(0);
      expect(boot.emitter.listenerCount(UserMediaStateChangedEvent.eventName)).toBeGreaterThan(0);
    });
  });

  describe('APP_ROLE=all (AppModule, today’s single process)', () => {
    beforeAll(async () => {
      boot = await bootRole('all', APP_MODULE, { ...REQUIRED_ENV, ...JWT_SECRETS });
    });
    afterAll(closeBoot);

    it('registers every processor, scheduler and gated controller', () => {
      expect(boot.composition.providers).toEqual(
        expect.arrayContaining([...WORKER_PROVIDERS, ...API_ONLY_PROVIDERS]),
      );
      expect(boot.composition.controllers).toEqual(expect.arrayContaining(GATED_CONTROLLERS));
      expect(boot.composition.modules).toEqual(expect.arrayContaining(API_ONLY_MODULES));
    });

    it('starts the same BullMQ workers as the worker role', () => {
      expect(mockStartedWorkerQueues).toEqual(expect.arrayContaining(WORKER_QUEUES));
    });

    it('keeps every in-process listener', () => {
      expect(boot.emitter.listenerCount(MediaSyncedEvent.eventName)).toBeGreaterThan(0);
      expect(boot.emitter.listenerCount(SHOW_EVENTS.NEW_EPISODE)).toBeGreaterThan(0);
      expect(boot.emitter.listenerCount(UserMediaRatingChangedEvent.eventName)).toBeGreaterThan(0);
      expect(boot.emitter.listenerCount(UserMediaStateChangedEvent.eventName)).toBeGreaterThan(0);
    });
  });
});
