import type { FxEvent, FxRarity } from '../types';
import { registerBuiltinScenes } from './builtin/register-builtin-scenes';
import type { FxSceneDefinition, FxSceneEvent, FxSceneId } from './contracts';

export class FxSceneRegistry {
  private readonly scenes = new Map<FxSceneId, FxSceneDefinition>();
  private sortedScenes: FxSceneDefinition[] = [];
  private sortedDirty = true;

  register<TSceneId extends FxSceneId>(scene: FxSceneDefinition<TSceneId>): void {
    if (this.scenes.has(scene.id)) {
      this.scenes.delete(scene.id);
    }
    this.scenes.set(scene.id, scene);
    this.sortedDirty = true;
  }

  resolve(event: FxEvent, rarity: FxRarity): FxSceneEvent | null {
    for (const scene of this.getScenesByPriority()) {
      if (!scene.supports(event)) continue;
      const nextScene = scene.create(event, rarity);
      if (scene.schema && !scene.schema(nextScene.payload)) continue;
      return nextScene;
    }

    return null;
  }

  private getScenesByPriority(): FxSceneDefinition[] {
    if (!this.sortedDirty) return this.sortedScenes;
    this.sortedScenes = Array.from(this.scenes.values()).sort(
      (left, right) => (right.priority ?? 0) - (left.priority ?? 0),
    );
    this.sortedDirty = false;
    return this.sortedScenes;
  }
}

export function createSceneRegistry(): FxSceneRegistry {
  return new FxSceneRegistry();
}

export function createDefaultSceneRegistry(): FxSceneRegistry {
  const registry = createSceneRegistry();
  registerBuiltinScenes(registry);
  return registry;
}
