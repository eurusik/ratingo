import { Logger } from '@nestjs/common';
import type IORedis from 'ioredis';

const logger = new Logger('Redis');

export const withRedisErrorLog = (connection: IORedis, name: string): IORedis =>
  connection.on('error', (error: Error) =>
    logger.warn({ message: 'redis.error', connection: name, reason: error.name }),
  );
