import { request } from 'node:http';

import {
  Controller,
  Get,
  Injectable,
  type INestApplication,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { closeHttpOnSignals, shutdownHttp } from './http-shutdown';

const SLOW_REQUEST_MS = 150;

const events: string[] = [];

@Injectable()
class FakeRedis implements OnModuleDestroy {
  private open = true;

  ping(): string {
    if (!this.open) {
      throw new Error('Connection is closed');
    }
    return 'PONG';
  }

  onModuleDestroy(): void {
    this.open = false;
    events.push('redis-closed');
  }
}

@Controller('probe')
class ProbeController {
  constructor(private readonly redis: FakeRedis) {}

  @Get('slow')
  async slow(): Promise<string> {
    events.push('request-started');
    await new Promise((resolve) => setTimeout(resolve, SLOW_REQUEST_MS));
    const reply = this.redis.ping();
    events.push('request-finished');
    return reply;
  }
}

interface Reply {
  status: number;
  body: string;
}

const get = (url: string): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const req = request(url, { agent: false, headers: { connection: 'close' } }, (res) => {
      let body = '';
      res.on('data', (chunk: Buffer) => void (body += chunk.toString()));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });

const untilRequestStarted = async (): Promise<void> => {
  const deadline = Date.now() + 3_000;
  while (!events.includes('request-started') && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

async function startApp(): Promise<{ app: INestApplication; url: string }> {
  const moduleRef = await Test.createTestingModule({
    controllers: [ProbeController],
    providers: [FakeRedis],
  }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.listen(0, '127.0.0.1');
  app.getHttpServer().on('close', () => events.push('http-closed'));
  return { app, url: await app.getUrl() };
}

describe('HTTP shutdown order', () => {
  beforeEach(() => {
    events.length = 0;
  });

  it('lets an in-flight request finish before the providers are destroyed', async () => {
    const { app, url } = await startApp();

    const inFlight = get(`${url}/probe/slow`);
    await untilRequestStarted();
    await shutdownHttp(app);
    const response = await inFlight;

    expect(response).toEqual({ status: 200, body: 'PONG' });
    expect(events).toEqual(['request-started', 'request-finished', 'http-closed', 'redis-closed']);
  });

  it('shows what Nest alone would do: app.close() destroys the providers under an in-flight request', async () => {
    const { app, url } = await startApp();

    const inFlight = get(`${url}/probe/slow`);
    await untilRequestStarted();
    await app.close();

    expect((await inFlight).status).toBe(500);
    expect(events.indexOf('redis-closed')).toBeLessThan(events.indexOf('http-closed'));
  });

  it('closes the server, then the providers, then flushes the logs and exits 0', async () => {
    const { app, url } = await startApp();
    let handler: ((signal: NodeJS.Signals) => void) | undefined;
    jest.spyOn(process, 'on').mockImplementation(((
      event: string,
      listener: (s: NodeJS.Signals) => void,
    ) => {
      if (event === 'SIGTERM') {
        handler = listener;
      }
      return process;
    }) as typeof process.on);
    const exited = new Promise<number>((resolve) => {
      jest.spyOn(process, 'exit').mockImplementation(((code: number) => {
        resolve(code);
      }) as never);
    });
    const flushLogs = jest.fn(async () => void events.push('logs-flushed'));

    closeHttpOnSignals(app, flushLogs);
    const inFlight = get(`${url}/probe/slow`);
    await untilRequestStarted();
    handler?.('SIGTERM');

    expect((await inFlight).status).toBe(200);
    expect(await exited).toBe(0);
    expect(events).toEqual([
      'request-started',
      'request-finished',
      'http-closed',
      'redis-closed',
      'logs-flushed',
    ]);
  });

  it('ignores a second signal while shutting down', async () => {
    const { app } = await startApp();
    let handler: ((signal: NodeJS.Signals) => void) | undefined;
    jest.spyOn(process, 'on').mockImplementation(((
      event: string,
      listener: (s: NodeJS.Signals) => void,
    ) => {
      if (event === 'SIGTERM') {
        handler = listener;
      }
      return process;
    }) as typeof process.on);
    const exited = new Promise<number>((resolve) => {
      jest.spyOn(process, 'exit').mockImplementation(((code: number) => {
        resolve(code);
      }) as never);
    });
    const flushLogs = jest.fn(async () => undefined);

    closeHttpOnSignals(app, flushLogs);
    handler?.('SIGTERM');
    handler?.('SIGTERM');
    await exited;

    expect(flushLogs).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event === 'redis-closed')).toHaveLength(1);
  });

  it('exits 1 after flushing when the server does not close in time', async () => {
    const { app } = await startApp();
    let handler: ((signal: NodeJS.Signals) => void) | undefined;
    jest.spyOn(process, 'on').mockImplementation(((
      event: string,
      listener: (s: NodeJS.Signals) => void,
    ) => {
      if (event === 'SIGTERM') {
        handler = listener;
      }
      return process;
    }) as typeof process.on);
    const exited = new Promise<number>((resolve) => {
      jest.spyOn(process, 'exit').mockImplementation(((code: number) => {
        resolve(code);
      }) as never);
    });
    const flushLogs = jest.fn(async () => void events.push('logs-flushed'));
    jest
      .spyOn(app.getHttpAdapter(), 'close')
      .mockImplementation(() => new Promise<void>(() => undefined));

    closeHttpOnSignals(app, flushLogs, 50);
    handler?.('SIGTERM');

    expect(await exited).toBe(1);
    expect(events).toContain('logs-flushed');
    jest.restoreAllMocks();
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
