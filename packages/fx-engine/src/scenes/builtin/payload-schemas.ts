import type {
  AchievementFxEvent,
  FxEvent,
  FxPayloadSchema,
  RankPromotedFxEvent,
  WeaponUnlockedFxEvent,
} from '../../types';

function hasStringTitle(payload: FxEvent): payload is FxEvent & { title: string } {
  return typeof payload.title === 'string' && payload.title.length > 0;
}

export const achievementUnlockedPayloadSchema: FxPayloadSchema<AchievementFxEvent> = (
  payload,
): payload is AchievementFxEvent => {
  if (!hasStringTitle(payload)) return false;
  if (payload.type === undefined) return true;
  return payload.type === 'achievement.unlocked';
};

export const rankPromotedPayloadSchema: FxPayloadSchema<RankPromotedFxEvent> = (
  payload,
): payload is RankPromotedFxEvent =>
  hasStringTitle(payload) && payload.type === 'rank.promoted';

export const weaponUnlockedPayloadSchema: FxPayloadSchema<WeaponUnlockedFxEvent> = (
  payload,
): payload is WeaponUnlockedFxEvent =>
  hasStringTitle(payload) && payload.type === 'weapon.unlocked';
