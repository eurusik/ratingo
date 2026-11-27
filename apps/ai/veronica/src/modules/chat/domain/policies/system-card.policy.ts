import type { SystemCard } from '../entities/system-card';

import { describeCadence } from '@ratingo/ai-ops-tools';

const bullets = (lines: readonly string[]): string => lines.map((line) => `- ${line}`).join('\n');

export const renderSystemCard = (card: SystemCard): string =>
  [
    'What Ratingo runs (generated from its code)',
    `Scheduled jobs (name: how often; what it does). Between its runs a weekly job normally shows no success for days:\n${bullets(
      card.scheduledJobs.map(
        (job) => `${job.job}: ${describeCadence(job.schedule)}; ${job.description}`,
      ),
    )}`,
    `Queues:\n${bullets(card.queues.map((queue) => `${queue.name}: ${queue.description}`))}`,
    `External APIs:\n${bullets(card.providers.map((provider) => `${provider.host}: ${provider.description}`))}`,
  ].join('\n\n');
