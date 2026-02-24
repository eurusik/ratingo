import type {
  AchievementFxEvent,
  FxEvent,
  FxRarity,
  RankPromotedFxEvent,
  WeaponUnlockedFxEvent,
} from '../types';

export interface FxScenePayloadMap {
  'achievement.unlocked': AchievementFxEvent;
  'rank.promoted': RankPromotedFxEvent;
  'weapon.unlocked': WeaponUnlockedFxEvent;
}

export type BuiltinFxSceneId = keyof FxScenePayloadMap;
export type FxSceneId = BuiltinFxSceneId | (string & {});

export interface FxSceneEvent<TSceneId extends FxSceneId = FxSceneId> {
  sceneId: TSceneId;
  rarity: FxRarity;
  payload: TSceneId extends BuiltinFxSceneId ? FxScenePayloadMap[TSceneId] : FxEvent;
}

export interface FxSceneDefinition<TSceneId extends FxSceneId = FxSceneId> {
  id: TSceneId;
  priority?: number;
  supports(event: FxEvent): boolean;
  create(event: FxEvent, rarity: FxRarity): FxSceneEvent<TSceneId>;
}
