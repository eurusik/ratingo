import { type ConfigService } from '@nestjs/config';

import { buildRedisConnectionOptions } from './redis-connection';

const configWith = (values: Record<string, unknown>): ConfigService =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('buildRedisConnectionOptions', () => {
  it('parses host, port and decoded password from REDIS_URL', () => {
    const options = buildRedisConnectionOptions(
      configWith({ REDIS_URL: 'redis://default:p%40ss@redis.internal:6380' }),
    );

    expect(options).toEqual({ host: 'redis.internal', port: 6380, password: 'p@ss' });
  });

  it('enables TLS for rediss URLs and defaults the port', () => {
    const options = buildRedisConnectionOptions(
      configWith({ REDIS_URL: 'rediss://cache.example' }),
    );

    expect(options).toEqual({ host: 'cache.example', port: 6379, tls: {} });
  });

  it('falls back to REDIS_HOST and REDIS_PORT without a URL', () => {
    const options = buildRedisConnectionOptions(
      configWith({ REDIS_HOST: 'redis', REDIS_PORT: 6390 }),
    );

    expect(options).toEqual({ host: 'redis', port: 6390 });
  });

  it('defaults to localhost:6379 when nothing is configured', () => {
    expect(buildRedisConnectionOptions(configWith({}))).toEqual({
      host: 'localhost',
      port: 6379,
    });
  });
});
