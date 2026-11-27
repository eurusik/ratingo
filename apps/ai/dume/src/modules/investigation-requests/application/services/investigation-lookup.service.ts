import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, type AgentFolder, type ClockPort } from '@ratingo/ai-core';

import { AGENT_FOLDER } from '../../../../core/ai-core.constants';
import type { InvestigationRecord } from '../../domain/entities/investigation-record';
import { interruptedIfStale } from '../../domain/policies/stale-run.policy';
import { REQUEST_STORE, type RequestStorePort } from '../../domain/ports/request-store.port';

@Injectable()
export class InvestigationLookupService {
  constructor(
    @Inject(REQUEST_STORE) private readonly store: RequestStorePort,
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async find(requestId: string): Promise<InvestigationRecord | null> {
    const record = await this.store.find(requestId);
    if (record === null) return null;
    const checked = interruptedIfStale(record, this.clock.nowMs(), this.folder.manifest.limits.timeoutMs);
    if (checked !== record) await this.store.save(checked);
    return checked;
  }
}
