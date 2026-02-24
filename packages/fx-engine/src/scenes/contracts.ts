import type { AchievementFxEvent, FxRarity } from '../types';

export interface FxScenePayloadMap {
  'achievement.unlocked': AchievementFxEvent;
}

export type FxSceneId = keyof FxScenePayloadMap;

export interface FxSceneEvent<TSceneId extends FxSceneId = FxSceneId> {
  sceneId: TSceneId;
  rarity: FxRarity;
  payload: FxScenePayloadMap[TSceneId];
}

export interface FxSceneDefinition<TSceneId extends FxSceneId = FxSceneId> {
  id: TSceneId;
  supports(event: AchievementFxEvent): boolean;
  create(event: AchievementFxEvent, rarity: FxRarity): FxSceneEvent<TSceneId>;
}
