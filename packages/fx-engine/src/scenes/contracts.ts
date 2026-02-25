import type {
  AchievementFxEvent,
  FxEvent,
  FxPayloadSchema,
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

export interface FxSceneEvent<
  TSceneId extends FxSceneId = FxSceneId,
  TPayload extends FxEvent = TSceneId extends BuiltinFxSceneId ? FxScenePayloadMap[TSceneId] : FxEvent,
> {
  sceneId: TSceneId;
  rarity: FxRarity;
  payload: TPayload;
}

export interface FxSceneDefinition<
  TSceneId extends FxSceneId = FxSceneId,
  TPayload extends FxEvent = TSceneId extends BuiltinFxSceneId ? FxScenePayloadMap[TSceneId] : FxEvent,
> {
  id: TSceneId;
  priority?: number;
  supports(event: FxEvent): boolean;
  create(event: FxEvent, rarity: FxRarity): FxSceneEvent<TSceneId, TPayload>;
  schema?: FxPayloadSchema<TPayload>;
}
