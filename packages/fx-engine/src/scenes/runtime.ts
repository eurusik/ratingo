import type { FxRenderOptions, FxRenderer } from '../types';
import type { FxSceneEvent } from './contracts';

export async function renderScene(
  renderer: FxRenderer,
  scene: FxSceneEvent,
  options: FxRenderOptions,
): Promise<void> {
  switch (scene.sceneId) {
    case 'achievement.unlocked':
      await renderer.playAchievement(scene.payload, options);
      return;
    default: {
      const unsupportedScene: never = scene.sceneId;
      throw new Error(`Unsupported scene: ${unsupportedScene as string}`);
    }
  }
}
