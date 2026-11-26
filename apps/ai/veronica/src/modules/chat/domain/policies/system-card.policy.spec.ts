import * as fc from 'fast-check';

import { SYSTEM_CARD, SYSTEM_CARD_MAX_CHARS } from '../constants/system-card.constants';
import type { SystemCard } from '../entities/system-card';

import { CUSTOM_CADENCE } from './schedule-cadence.policy';
import { renderSystemCard } from './system-card.policy';

describe('renderSystemCard', () => {
  const card = renderSystemCard(SYSTEM_CARD);

  it('stays within its share of the chat prompt', () => {
    expect(card.length).toBeLessThanOrEqual(SYSTEM_CARD_MAX_CHARS);
  });

  it('names every scheduled job, queue and provider', () => {
    const names = [
      ...SYSTEM_CARD.scheduledJobs.map((job) => job.job),
      ...SYSTEM_CARD.queues.map((queue) => queue.name),
      ...SYSTEM_CARD.providers.map((provider) => provider.host),
    ];

    expect(names.filter((name) => !card.includes(`- ${name}: `))).toEqual([]);
  });

  it('says how often every job runs in words, never as cron', () => {
    expect(card).not.toContain(CUSTOM_CADENCE);
    expect(card).not.toMatch(/\*|\d+ \d+ \*/);
  });

  it('holds no digits, so the numbers guard never has to trust it', () => {
    expect(card).not.toMatch(/\d/);
  });

  it('describes the weekly job the digest once took for broken', () => {
    expect(card).toContain('- scheduled-upcoming-movies-refresh-all: weekly on Monday; ');
    expect(card).toContain('- scheduled-upcoming-movies-refresh-soon: daily except Monday; ');
  });
});

describe('renderSystemCard for any card', () => {
  const name = fc.stringMatching(/^[a-z][a-z0-9-]{0,30}$/);
  const description = fc.stringMatching(/^[A-Za-z][A-Za-z ,.]{0,60}$/);
  const schedule = fc.oneof(
    fc
      .tuple(
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 6 }),
      )
      .map(([minute, hour, day]) => ({ cron: `${minute} ${hour} * * ${day}` })),
    fc.integer({ min: 1, max: 600 }).map((minutes) => ({ everyMs: minutes * 60_000 })),
  );
  const card: fc.Arbitrary<SystemCard> = fc.record({
    scheduledJobs: fc.array(fc.record({ job: name, queue: name, schedule, description })),
    queues: fc.array(fc.record({ name, description })),
    providers: fc.array(fc.record({ host: name, description })),
  });

  it('gives every entry its own bullet and never shows cron', () => {
    fc.assert(
      fc.property(card, (generated) => {
        const text = renderSystemCard(generated);
        const bullets = text.split('\n').filter((line) => line.startsWith('- '));

        expect(bullets).toHaveLength(
          generated.scheduledJobs.length + generated.queues.length + generated.providers.length,
        );
        expect(text).not.toMatch(/\*/);
      }),
    );
  });
});
