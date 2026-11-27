import { Injectable } from '@nestjs/common';

import { kyivDateOf } from '@ratingo/ai-ops-tools';
import type { Snapshot } from '../../domain/entities/snapshot';
import { ApiKeysCollector } from '../collectors/api-keys.collector';
import { BackupCollector } from '../collectors/backup.collector';
import { HttpErrorsCollector } from '../collectors/http-errors.collector';
import { InfraCollector } from '../collectors/infra.collector';
import { ProductCollector } from '../collectors/product.collector';
import { QueuesCollector } from '../collectors/queues.collector';
import { SiteCollector } from '../collectors/site.collector';
import { SchedulerCollector } from '../collectors/scheduler.collector';

@Injectable()
export class SnapshotService {
  constructor(
    private readonly product: ProductCollector,
    private readonly site: SiteCollector,
    private readonly queues: QueuesCollector,
    private readonly apiKeys: ApiKeysCollector,
    private readonly httpErrors: HttpErrorsCollector,
    private readonly backup: BackupCollector,
    private readonly infra: InfraCollector,
    private readonly scheduler: SchedulerCollector,
  ) {}

  async take(nowMs: number): Promise<Snapshot> {
    const [product, site, queues, apiKeys, httpErrors, backup, infra, scheduler] =
      await Promise.all([
        this.product.collect(nowMs),
        this.site.collect(nowMs),
        this.queues.collect(nowMs),
        this.apiKeys.collect(nowMs),
        this.httpErrors.collect(nowMs),
        this.backup.collect(nowMs),
        this.infra.collect(nowMs),
        this.scheduler.collect(nowMs),
      ]);
    return {
      date: kyivDateOf(nowMs),
      generatedAtMs: nowMs,
      product,
      site,
      queues,
      apiKeys,
      httpErrors,
      backup,
      infra,
      scheduler,
    };
  }
}
