import { Injectable } from '@nestjs/common';

import { DigestComposeService, type Digest } from '../../../digest/public';

const summarize = (digest: Digest) => ({
  date: digest.date,
  level: digest.level,
  blocks: digest.blocks.map((block) => ({
    block: block.block,
    items: block.items.map((item) => ({ id: item.id, level: item.level, advice: item.advice })),
    facts: block.facts.map((fact) => ({
      label: fact.label,
      unit: fact.unit,
      current: fact.current,
      lastWeek: fact.baseline,
    })),
  })),
  sources: digest.sources.map((source) => ({
    source: source.source,
    state: source.state,
    ...(source.reason === undefined ? {} : { reason: source.reason }),
  })),
});

@Injectable()
export class DigestSnapshotExecutor {
  constructor(private readonly digests: DigestComposeService) {}

  async run(): Promise<unknown> {
    return summarize(await this.digests.evaluate());
  }
}
