import type Redis from 'ioredis';

import {
  RECORD_KEY_PREFIX,
  RECORD_TTL_SECONDS,
} from '../../investigation-requests.constants';
import type { InvestigationRecord } from '../../domain/entities/investigation-record';
import { CreateOutcome, type RequestStorePort } from '../../domain/ports/request-store.port';

type RedisCommands = Pick<Redis, 'set' | 'get'>;

export class RedisRequestStore implements RequestStorePort {
  constructor(private readonly redis: RedisCommands) {}

  async create(record: InvestigationRecord): Promise<CreateOutcome> {
    const stored = await this.redis.set(
      this.keyFor(record.requestId),
      JSON.stringify(record),
      'EX',
      RECORD_TTL_SECONDS,
      'NX',
    );
    return stored === 'OK' ? CreateOutcome.CREATED : CreateOutcome.EXISTS;
  }

  async find(requestId: string): Promise<InvestigationRecord | null> {
    const raw = await this.redis.get(this.keyFor(requestId));
    return raw === null ? null : (JSON.parse(raw) as InvestigationRecord);
  }

  async save(record: InvestigationRecord): Promise<void> {
    await this.redis.set(
      this.keyFor(record.requestId),
      JSON.stringify(record),
      'EX',
      RECORD_TTL_SECONDS,
    );
  }

  private keyFor(requestId: string): string {
    return `${RECORD_KEY_PREFIX}${requestId}`;
  }
}
