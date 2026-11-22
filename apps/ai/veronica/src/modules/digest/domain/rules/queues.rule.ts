import { DigestBlock } from '../constants/digest-block.constants';
import { DigestLevel } from '../constants/digest-level.constants';
import type { DigestItem, RuleOutcome } from '../entities/digest';
import { FactUnit } from '../entities/digest';
import type { DigestThresholds } from '../entities/digest-thresholds';
import { measured } from '../entities/measured';
import type { QueueStats } from '../entities/snapshot';
import { HOURS_PER_DAY, PERCENT, factOf, itemOf, share, sumMeasured } from './rule-helpers';

type QueueThresholds = DigestThresholds['queues'];

const topFailingJob = (queue: QueueStats): string | null =>
  [...queue.failedJobs].sort((a, b) => b.count - a.count)[0]?.jobName ?? null;

const failureItem = (queue: QueueStats, limits: QueueThresholds): DigestItem | null => {
  const failed = queue.failed24h.current;
  const total = queue.completed24h.current + failed;
  const failureShare = share(failed, total);
  const failureFacts = [
    factOf('помилок', FactUnit.COUNT, queue.failed24h),
    factOf('частка помилок', FactUnit.PERCENT, measured(Math.round(failureShare * PERCENT))),
  ];
  if (failed >= limits.failureMinVolume && failureShare >= limits.failureShareForAction) {
    const job = topFailingJob(queue);
    const subject = job === null ? 'завдання' : `завдання «${job}»`;
    return itemOf(
      `queue-failures:${queue.queue}`,
      DigestBlock.JOBS,
      DigestLevel.ACTION,
      `У черзі «${queue.queue}» падають ${subject}. Подивись помилки у воркері й запусти їх знову.`,
      failureFacts,
    );
  }
  if (failed > 0 || queue.retried24h.current >= limits.failureMinVolume) {
    return itemOf(
      `queue-failures:${queue.queue}`,
      DigestBlock.JOBS,
      DigestLevel.NOTE,
      `У черзі «${queue.queue}» були поодинокі збої. Це не критично, але варто поглянути на помилки.`,
      [...failureFacts, factOf('повторів', FactUnit.COUNT, queue.retried24h)],
    );
  }
  return null;
};

const drainItem = (queue: QueueStats, limits: QueueThresholds): DigestItem | null => {
  if (queue.backlogNow < limits.minBacklog) {
    return null;
  }
  const noteOnly = limits.backlogNoteOnly.includes(queue.queue);
  const ceiling = noteOnly ? DigestLevel.NOTE : DigestLevel.ACTION;
  const ratePerHour = queue.completed24h.current / HOURS_PER_DAY;
  const backlogFact = factOf('у черзі зараз', FactUnit.COUNT, measured(queue.backlogNow));
  if (ratePerHour === 0) {
    return itemOf(
      `queue-drain:${queue.queue}`,
      DigestBlock.JOBS,
      ceiling,
      `Черга «${queue.queue}» стоїть: завдання накопичуються, а виконаних немає. Перезапусти воркер.`,
      [backlogFact],
    );
  }
  const drainHours = queue.backlogNow / ratePerHour;
  const drainFact = factOf(
    'розбиратиметься годин',
    FactUnit.HOURS,
    measured(Math.round(drainHours)),
  );
  if (drainHours >= limits.drainHoursForAction) {
    return itemOf(
      `queue-drain:${queue.queue}`,
      DigestBlock.JOBS,
      ceiling,
      `Черга «${queue.queue}» не встигає: роботи більше, ніж воркер розбирає. Перевір воркер або ліміти зовнішніх сервісів.`,
      [backlogFact, drainFact],
    );
  }
  if (drainHours >= limits.drainHoursForNote) {
    return itemOf(
      `queue-drain:${queue.queue}`,
      DigestBlock.JOBS,
      DigestLevel.NOTE,
      `Черга «${queue.queue}» розбирається повільно, але рухається.`,
      [backlogFact, drainFact],
    );
  }
  return null;
};

export const evaluateQueues = (
  queues: readonly QueueStats[],
  thresholds: DigestThresholds,
): RuleOutcome => {
  const limits = thresholds.queues;
  const items = queues.flatMap((queue) =>
    [failureItem(queue, limits), drainItem(queue, limits)].filter(
      (item): item is DigestItem => item !== null,
    ),
  );
  return {
    items,
    facts: [
      factOf('виконано завдань', FactUnit.COUNT, sumMeasured(queues.map((q) => q.completed24h))),
      factOf('помилок', FactUnit.COUNT, sumMeasured(queues.map((q) => q.failed24h))),
      factOf('найбільша черга', FactUnit.COUNT, sumMeasured(queues.map((q) => q.backlogMax24h))),
    ],
  };
};
