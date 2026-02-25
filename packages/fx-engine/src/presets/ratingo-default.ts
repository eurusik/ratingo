import { playAchievementUnlockedScene } from '../renderer/pixi/scenes/play-achievement-unlocked-scene';
import type { PixiScenePlayerContext } from '../pixi-renderer';
import { achievementUnlockedScene } from '../scenes/builtin/achievement-unlocked.scene';
import { rankPromotedScene } from '../scenes/builtin/rank-promoted.scene';
import {
  achievementUnlockedPayloadSchema,
  rankPromotedPayloadSchema,
} from '../scenes/builtin/payload-schemas';
import type { FxEvent, FxPayloadSchema, FxSceneRegistration, FxScenePlayer } from '../types';

const RATINGO_SCENE_SCHEMAS = {
  'achievement.unlocked': achievementUnlockedPayloadSchema,
  'rank.promoted': rankPromotedPayloadSchema,
} as const;

const RATINGO_SCENES: readonly FxSceneRegistration[] = [
  rankPromotedScene as FxSceneRegistration,
  achievementUnlockedScene as FxSceneRegistration,
];

const RATINGO_SCENE_IDS = Object.keys(RATINGO_SCENE_SCHEMAS) as Array<
  keyof typeof RATINGO_SCENE_SCHEMAS
>;

function resolveRatingoSceneSchema(sceneId: keyof typeof RATINGO_SCENE_SCHEMAS): FxPayloadSchema {
  return RATINGO_SCENE_SCHEMAS[sceneId];
}

export interface FxPresetTarget {
  registerScene<TPayload extends FxEvent = FxEvent>(scene: FxSceneRegistration<TPayload>): void;
  registerScenePlayer<TPayload extends FxEvent = FxEvent>(
    sceneId: string,
    player: FxScenePlayer<TPayload, PixiScenePlayerContext>,
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
    for (const scene of RATINGO_SCENES) {
      target.registerScene(scene);
    }
  }

  if (!installScenePlayers) return;

  const defaultPlayer: FxScenePlayer<FxEvent, PixiScenePlayerContext> = async (
    event,
    renderOptions,
    context,
  ) => {
    await playAchievementUnlockedScene(context.app, event, renderOptions, context);
  };

  for (const sceneId of RATINGO_SCENE_IDS) {
    target.registerScenePlayer(sceneId, defaultPlayer, resolveRatingoSceneSchema(sceneId));
  }
}
