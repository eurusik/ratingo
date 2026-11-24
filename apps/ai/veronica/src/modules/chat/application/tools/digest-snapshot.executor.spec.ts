import { DigestComposeService } from '../../../digest/application/services/digest-compose.service';
import { TelegramDigestTemplate } from '../../../digest/infrastructure/templates/telegram-digest.template';
import { NOW_MS, redSnapshot } from '../../../digest/testing/digest.testing';

import { DigestSnapshotExecutor } from './digest-snapshot.executor';

describe('DigestSnapshotExecutor', () => {
  it('shows levels, advice, numbers with last week and the sources', async () => {
    const composer = new DigestComposeService(
      { take: async () => redSnapshot() } as never,
      {} as never,
      new TelegramDigestTemplate(),
      { nowMs: () => NOW_MS },
    );
    const result = (await new DigestSnapshotExecutor(composer).run()) as {
      level: string;
      blocks: { block: string; items: { level: string }[]; facts: { lastWeek: unknown }[] }[];
      sources: { source: string; state: string }[];
    };
    expect(result.level).toBe('action');
    expect(result.blocks.map((block) => block.block)).toContain('jobs');
    expect(result.blocks.some((block) => block.items.some((item) => item.level === 'action'))).toBe(
      true,
    );
    expect(
      result.blocks.some((block) => block.facts.some((fact) => fact.lastWeek !== undefined)),
    ).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
  });
});
