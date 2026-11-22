import { DigestBlock } from '../constants/digest-block.constants';
import { DigestLevel } from '../constants/digest-level.constants';
import type { DigestItem, Fact, RuleOutcome } from '../entities/digest';
import { FactUnit } from '../entities/digest';
import type { DigestThresholds } from '../entities/digest-thresholds';
import type { BackupStats } from '../entities/snapshot';
import { BackupResult } from '../entities/snapshot';
import { BYTES_PER_MEGABYTE, itemOf } from './rule-helpers';

export const evaluateBackup = (backup: BackupStats, thresholds: DigestThresholds): RuleOutcome => {
  const limits = thresholds.backup;
  const facts: Fact[] = [];
  const items: DigestItem[] = [];
  if (backup.lastRunAgeHours !== null) {
    facts.push({
      label: 'останній бекап, годин тому',
      unit: FactUnit.HOURS,
      current: Math.round(backup.lastRunAgeHours),
      baseline: null,
    });
  }
  if (backup.sizeBytes !== null) {
    facts.push({
      label: 'розмір бекапу',
      unit: FactUnit.MEGABYTES,
      current: Math.round(backup.sizeBytes.current / BYTES_PER_MEGABYTE),
      baseline:
        backup.sizeBytes.baseline === null
          ? null
          : Math.round(backup.sizeBytes.baseline / BYTES_PER_MEGABYTE),
    });
  }
  if (backup.lastResult === BackupResult.FAILURE) {
    items.push(
      itemOf(
        'backup-failed',
        DigestBlock.STORAGE,
        DigestLevel.ACTION,
        'Останній бекап завершився помилкою. Перевір логи сервісу бекапу.',
        facts,
      ),
    );
  } else if (backup.lastRunAgeHours !== null && backup.lastRunAgeHours >= limits.staleHours) {
    items.push(
      itemOf(
        'backup-stale',
        DigestBlock.STORAGE,
        DigestLevel.ACTION,
        'Бекап не робився занадто давно. Запусти його вручну й перевір cron-сервіс.',
        facts,
      ),
    );
  }
  const size = backup.sizeBytes;
  if (
    size !== null &&
    size.baseline !== null &&
    size.baseline > 0 &&
    size.current < size.baseline * (1 - limits.shrinkRatioForNote)
  ) {
    items.push(
      itemOf(
        'backup-shrunk',
        DigestBlock.STORAGE,
        DigestLevel.NOTE,
        'Бекап став помітно меншим, ніж тиждень тому. Переконайся, що в ньому все на місці.',
        facts,
      ),
    );
  }
  return { items, facts };
};
