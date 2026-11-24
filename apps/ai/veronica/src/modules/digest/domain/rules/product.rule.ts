import { DigestBlock } from '../constants/digest-block.constants';
import { DigestLevel } from '../constants/digest-level.constants';
import type { DigestItem, RuleOutcome } from '../entities/digest';
import { FactUnit } from '../entities/digest';
import type { DigestThresholds } from '../entities/digest-thresholds';
import type { Measured } from '../entities/measured';
import type { ProductStats } from '../entities/snapshot';
import { factOf, itemOf } from './rule-helpers';

type ProductThresholds = DigestThresholds['product'];

const hasBaseline = (value: Measured, limits: ProductThresholds): boolean =>
  value.baseline !== null && value.baseline >= limits.minBaseline;

const isDrop = (value: Measured, limits: ProductThresholds): boolean =>
  hasBaseline(value, limits) &&
  value.current < (value.baseline as number) * (1 - limits.dropRatioForNote);

export const evaluateProduct = (
  product: ProductStats,
  thresholds: DigestThresholds,
): RuleOutcome => {
  const limits = thresholds.product;
  const facts = [
    factOf('нових користувачів', FactUnit.COUNT, product.newUsers),
    factOf('дій користувачів', FactUnit.COUNT, product.actions),
  ];
  const items: DigestItem[] = [];
  if (product.newUsers.current === 0 && hasBaseline(product.newUsers, limits)) {
    items.push(
      itemOf(
        'product-signups-stopped',
        DigestBlock.PEOPLE,
        DigestLevel.ACTION,
        'Нових користувачів немає, хоча раніше вони щодня були. Перевір реєстрацію і вхід.',
        [facts[0]],
      ),
    );
  } else if (isDrop(product.newUsers, limits)) {
    items.push(
      itemOf(
        'product-signups-dropped',
        DigestBlock.PEOPLE,
        DigestLevel.NOTE,
        'Нових користувачів помітно менше, ніж тиждень тому.',
        [facts[0]],
      ),
    );
  }
  if (isDrop(product.actions, limits)) {
    items.push(
      itemOf(
        'product-actions-dropped',
        DigestBlock.PEOPLE,
        DigestLevel.NOTE,
        'Користувачі роблять помітно менше дій, ніж тиждень тому.',
        [facts[1]],
      ),
    );
  }
  return { items, facts };
};
