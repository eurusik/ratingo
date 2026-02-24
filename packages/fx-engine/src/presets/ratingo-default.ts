import type { Application } from 'pixi.js';
import { playAchievementUnlockedScene } from '../renderer/pixi/scenes/play-achievement-unlocked-scene';
import { registerBuiltinScenes } from '../scenes/builtin/register-builtin-scenes';
import type { BuiltinFxSceneId } from '../scenes/contracts';
import {
  achievementUnlockedPayloadSchema,
  rankPromotedPayloadSchema,
  weaponUnlockedPayloadSchema,
} from '../scenes/builtin/payload-schemas';
import type { FxEvent, FxPayloadSchema, FxSceneRegistration, FxScenePlayer } from '../types';

const BUILTIN_SCENE_SCHEMAS: Record<BuiltinFxSceneId, FxPayloadSchema> = {
  'achievement.unlocked': achievementUnlockedPayloadSchema,
  'rank.promoted': rankPromotedPayloadSchema,
  'weapon.unlocked': weaponUnlockedPayloadSchema,
};

export interface FxPresetTarget {
  registerScene<TPayload extends FxEvent = FxEvent>(scene: FxSceneRegistration<TPayload>): void;
  registerScenePlayer<TPayload extends FxEvent = FxEvent>(
    sceneId: string,
    player: FxScenePlayer<TPayload>,
    schema?: FxPayloadSchema<TPayload>,
  ): void;
}

export interface RatingoDefaultPresetOptions {
  scenes?: boolean;
  scenePlayers?: boolean;
}

export function installRatingoDefaultPreset(
  target: FxPresetTarget,
  options: RatingoDefaultPresetOptions = {},
): void {
  const installScenes = options.scenes ?? true;
  const installScenePlayers = options.scenePlayers ?? true;

  if (installScenes) {
    registerBuiltinScenes({
      register: (scene) => target.registerScene(scene as FxSceneRegistration),
    });
  }

  if (!installScenePlayers) return;

  const defaultPlayer: FxScenePlayer = async (event, renderOptions, context) => {
    await playAchievementUnlockedScene(context.app as Application, event, renderOptions);
  };

  for (const [sceneId, schema] of Object.entries(BUILTIN_SCENE_SCHEMAS)) {
    target.registerScenePlayer(sceneId, defaultPlayer, schema);
  }
}
