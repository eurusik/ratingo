import type IORedis from 'ioredis';

import { RepairOutcome, type QueueKeyRepairPort } from '../../domain/ports/watchdog.ports';
import { LEGACY_ACTIVE_JOBS_LIST_KEY } from '../../watchdog.constants';

const LIST_TYPE = 'list';
const MISSING_TYPE = 'none';

export class RedisQueueKeyRepair implements QueueKeyRepairPort {
  constructor(private readonly redis: Pick<IORedis, 'type' | 'del'>) {}

  async repairActiveJobsList(): Promise<{ outcome: RepairOutcome; foundType: string }> {
    const foundType = await this.redis.type(LEGACY_ACTIVE_JOBS_LIST_KEY);
    if (foundType === LIST_TYPE || foundType === MISSING_TYPE) {
      return { outcome: RepairOutcome.HEALTHY, foundType };
    }
    await this.redis.del(LEGACY_ACTIVE_JOBS_LIST_KEY);
    return { outcome: RepairOutcome.REPAIRED, foundType };
  }
}
