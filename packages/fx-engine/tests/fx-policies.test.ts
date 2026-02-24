import { describe, expect, it } from '@jest/globals';
import {
  buildDedupeKey,
  createSummaryAchievement,
  shouldDropByDedupe,
  shouldDropByEpicCooldown,
  shouldMergeQueue,
} from '../src/core/policy/fx-policies';

describe('fx-policies', () => {
  it('prefers explicit id for dedupe key', () => {
    const key = buildDedupeKey({ id: 'achv-1', title: 'Rank Up' }, 'epic');
    expect(key).toBe('achv-1');
  });

  it('builds fallback dedupe key from title and rarity', () => {
    const key = buildDedupeKey({ title: 'Rank Up' }, 'legendary');
    expect(key).toBe('achievement.unlocked::rank up::legendary');
  });

  it('includes event type in fallback dedupe key', () => {
    const key = buildDedupeKey(
      {
        type: 'weapon.unlocked',
        title: 'Rank Up',
      },
      'legendary',
    );
    expect(key).toBe('weapon.unlocked::rank up::legendary');
  });

  it('drops duplicate events inside dedupe window', () => {
    expect(shouldDropByDedupe(5_000, 6_000, 2_000)).toBe(true);
    expect(shouldDropByDedupe(5_000, 7_500, 2_000)).toBe(false);
    expect(shouldDropByDedupe(undefined, 7_500, 2_000)).toBe(false);
  });

  it('applies epic cooldown only for epic tiers', () => {
    expect(shouldDropByEpicCooldown('common', 10_000, 9_500, 1_000)).toBe(false);
    expect(shouldDropByEpicCooldown('epic', 10_000, 9_500, 1_000)).toBe(true);
    expect(shouldDropByEpicCooldown('legendary', 10_000, 8_000, 1_000)).toBe(false);
  });

  it('merges queue only when threshold reached', () => {
    expect(shouldMergeQueue(3, 4)).toBe(false);
    expect(shouldMergeQueue(4, 4)).toBe(true);
    expect(shouldMergeQueue(7, 4)).toBe(true);
  });

  it('creates summary achievement with expected shape', () => {
    expect(createSummaryAchievement(3)).toEqual({
      type: 'achievement.unlocked',
      title: '+3 achievements',
      subtitle: 'Unlocked in a row',
      rarity: 'rare',
    });
  });
});
