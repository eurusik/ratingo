import type { AchievementFxEvent, FxRarity } from '../../types';

export function buildDedupeKey(event: AchievementFxEvent, rarity: FxRarity): string {
  return event.id ?? `${event.title.toLowerCase()}::${rarity}`;
}

export function shouldDropByDedupe(lastSeenMs: number | undefined, nowMs: number, windowMs: number): boolean {
  if (!lastSeenMs) return false;
  return nowMs - lastSeenMs < windowMs;
}

export function shouldDropByEpicCooldown(
  rarity: FxRarity,
  nowMs: number,
  lastEpicAtMs: number,
  cooldownMs: number,
): boolean {
  const isEpicTier = rarity === 'epic' || rarity === 'legendary';
  if (!isEpicTier) return false;
  return nowMs - lastEpicAtMs < cooldownMs;
}

export function shouldMergeQueue(queueLength: number, summaryThreshold: number): boolean {
  return queueLength >= summaryThreshold;
}

export function createSummaryAchievement(queueLength: number): AchievementFxEvent {
  return {
    title: `+${queueLength} achievements`,
    subtitle: 'Unlocked in a row',
    rarity: 'rare',
  };
}
