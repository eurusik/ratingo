import type { FxEvent, FxRenderOptions, FxRenderer } from '../types';
import type { FxSceneEvent } from './contracts';

export async function renderScene(
  renderer: FxRenderer,
  scene: FxSceneEvent,
  options: FxRenderOptions,
): Promise<void> {
  switch (scene.sceneId) {
    case 'achievement.unlocked':
    case 'rank.promoted':
    case 'weapon.unlocked':
      await renderer.playAchievement(scene.payload, options);
      return;
    default: {
      await renderer.playAchievement(scene.payload as FxEvent, options);
    }
  }
}
