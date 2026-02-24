import { achievementUnlockedScene } from './achievement-unlocked.scene';
import { rankPromotedScene } from './rank-promoted.scene';
import { weaponUnlockedScene } from './weapon-unlocked.scene';
import type { FxSceneDefinition } from '../contracts';

const BUILTIN_SCENES: readonly FxSceneDefinition[] = [
  rankPromotedScene,
  weaponUnlockedScene,
  achievementUnlockedScene,
];

interface FxSceneRegistrar {
  register(scene: FxSceneDefinition): void;
}

export function registerBuiltinScenes(registrar: FxSceneRegistrar): void {
  for (const scene of BUILTIN_SCENES) {
    registrar.register(scene);
  }
}
