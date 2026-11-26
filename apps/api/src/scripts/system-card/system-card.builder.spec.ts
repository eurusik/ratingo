import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { scheduledJobNames } from '@/telemetry/scheduler-last-run.gauge';

import { SYSTEM_CARD_PATH, buildSystemCard, renderSystemCardFile } from './system-card.builder';

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../..');

describe('system card', () => {
  it('matches the checked-in artifact; run npm run system-card:update when this fails', () => {
    const checkedIn = readFileSync(path.join(REPOSITORY_ROOT, SYSTEM_CARD_PATH), 'utf8');

    expect(checkedIn).toBe(renderSystemCardFile());
  });

  it('describes every scheduled job the metrics report', () => {
    const described = buildSystemCard().scheduledJobs.map((job) => job.job);

    expect(new Set(described)).toEqual(scheduledJobNames());
  });

  it('gives every job, queue and provider a description', () => {
    const card = buildSystemCard();
    const descriptions = [...card.scheduledJobs, ...card.queues, ...card.providers].map(
      (entry) => entry.description,
    );

    expect(descriptions.every((text) => text.trim().length > 0)).toBe(true);
  });
});
