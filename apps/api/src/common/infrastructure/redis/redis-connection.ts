import { type ConfigService } from '@nestjs/config';

import { type RedisOptions } from 'ioredis';

const DEFAULT_REDIS_HOST = 'localhost';
const DEFAULT_REDIS_PORT = 6379;

export type RedisConnectionOptions = Pick<RedisOptions, 'host' | 'port' | 'password' | 'tls'>;

export function buildRedisConnectionOptions(config: ConfigService): RedisConnectionOptions {
  const redisUrl = config.get<string>('REDIS_URL');
  if (!redisUrl) {
    return {
      host: config.get<string>('REDIS_HOST') ?? DEFAULT_REDIS_HOST,
      port: config.get<number>('REDIS_PORT') ?? DEFAULT_REDIS_PORT,
    };
  }

  const url = new URL(redisUrl);
  const password = url.password ? decodeURIComponent(url.password) : undefined;
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : DEFAULT_REDIS_PORT,
    ...(password && { password }),
    ...(url.protocol === 'rediss:' && { tls: {} }),
  };
}
