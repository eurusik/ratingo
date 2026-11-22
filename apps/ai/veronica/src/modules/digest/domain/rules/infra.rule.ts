import { DigestBlock } from '../constants/digest-block.constants';
import { DigestLevel } from '../constants/digest-level.constants';
import type { DigestItem, Fact, RuleOutcome } from '../entities/digest';
import { FactUnit } from '../entities/digest';
import type { DigestThresholds } from '../entities/digest-thresholds';
import type { InfraStats } from '../entities/snapshot';
import { PERCENT, itemOf } from './rule-helpers';

export const evaluateInfra = (infra: InfraStats, thresholds: DigestThresholds): RuleOutcome => {
  const items: DigestItem[] = [];
  const facts: Fact[] = [];
  if (!infra.databaseUp) {
    items.push(
      itemOf(
        'infra-database-down',
        DigestBlock.STORAGE,
        DigestLevel.ACTION,
        'База даних не відповідає. Перевір Postgres на Railway.',
      ),
    );
  }
  if (!infra.redisUp) {
    items.push(
      itemOf(
        'infra-redis-down',
        DigestBlock.STORAGE,
        DigestLevel.ACTION,
        'Redis не відповідає. Без нього зупиняться черги. Перевір Redis на Railway.',
      ),
    );
  }
  if (infra.redisMemoryUsedRatio !== null) {
    const used: Fact = {
      label: 'пам’ять Redis',
      unit: FactUnit.PERCENT,
      current: Math.round(infra.redisMemoryUsedRatio * PERCENT),
      baseline: null,
    };
    facts.push(used);
    if (infra.redisMemoryUsedRatio >= thresholds.infra.redisMemoryRatioForNote) {
      items.push(
        itemOf(
          'infra-redis-memory',
          DigestBlock.STORAGE,
          DigestLevel.NOTE,
          'Redis майже заповнений. Подивись, що займає пам’ять.',
          [used],
        ),
      );
    }
  }
  return { items, facts };
};
