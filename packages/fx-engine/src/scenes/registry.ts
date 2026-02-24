import type { AchievementFxEvent, FxRarity } from '../types';
import { achievementUnlockedScene } from './builtin/achievement-unlocked.scene';
import type { FxSceneDefinition, FxSceneEvent, FxSceneId } from './contracts';

export class FxSceneRegistry {
  private readonly scenes = new Map<FxSceneId, FxSceneDefinition>();

  register<TSceneId extends FxSceneId>(scene: FxSceneDefinition<TSceneId>): void {
    if (this.scenes.has(scene.id)) {
      this.scenes.delete(scene.id);
    }
    this.scenes.set(scene.id, scene);
  }

  resolve(event: AchievementFxEvent, rarity: FxRarity): FxSceneEvent {
    for (const scene of this.scenes.values()) {
      if (scene.supports(event)) {
        return scene.create(event, rarity);
      }
    }

    return achievementUnlockedScene.create(event, rarity);
  }
}

export function createDefaultSceneRegistry(): FxSceneRegistry {
  const registry = new FxSceneRegistry();
  registry.register(achievementUnlockedScene);
  return registry;
}
