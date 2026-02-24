import type { FxEvent, FxRarity } from '../types';
import { achievementUnlockedScene } from './builtin/achievement-unlocked.scene';
import { rankPromotedScene } from './builtin/rank-promoted.scene';
import { weaponUnlockedScene } from './builtin/weapon-unlocked.scene';
import type { FxSceneDefinition, FxSceneEvent, FxSceneId } from './contracts';

export class FxSceneRegistry {
  private readonly scenes = new Map<FxSceneId, FxSceneDefinition>();

  register<TSceneId extends FxSceneId>(scene: FxSceneDefinition<TSceneId>): void {
    if (this.scenes.has(scene.id)) {
      this.scenes.delete(scene.id);
    }
    this.scenes.set(scene.id, scene);
  }

  resolve(event: FxEvent, rarity: FxRarity): FxSceneEvent {
    const sortedScenes = Array.from(this.scenes.values()).sort(
      (left, right) => (right.priority ?? 0) - (left.priority ?? 0),
    );

    for (const scene of sortedScenes) {
      if (scene.supports(event)) {
        return scene.create(event, rarity);
      }
    }

    return achievementUnlockedScene.create(event, rarity);
  }
}

export function createDefaultSceneRegistry(): FxSceneRegistry {
  const registry = new FxSceneRegistry();
  registry.register(rankPromotedScene);
  registry.register(weaponUnlockedScene);
  registry.register(achievementUnlockedScene);
  return registry;
}
