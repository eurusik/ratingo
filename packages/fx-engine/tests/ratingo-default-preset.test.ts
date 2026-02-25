import { describe, expect, it, jest } from '@jest/globals';
import { installRatingoDefaultPreset } from '../src/presets/ratingo-default';
import type { FxSceneRegistration } from '../src/types';

describe('installRatingoDefaultPreset', () => {
  it('registers only ratingo-relevant builtins (achievement, rank)', () => {
    const registerScene = jest.fn<(scene: FxSceneRegistration) => void>();
    const registerScenePlayer = jest.fn<
      (sceneId: string, player: unknown, schema?: unknown) => void
    >();

    installRatingoDefaultPreset({
      registerScene,
      registerScenePlayer,
    });

    const registeredSceneIds = registerScene.mock.calls
      .map(([scene]) => scene.id)
      .sort();
    const registeredPlayerSceneIds = registerScenePlayer.mock.calls
      .map(([sceneId]) => sceneId)
      .sort();

    expect(registeredSceneIds).toEqual(['achievement.unlocked', 'rank.promoted']);
    expect(registeredPlayerSceneIds).toEqual(['achievement.unlocked', 'rank.promoted']);
    expect(registeredSceneIds).not.toContain('weapon.unlocked');
    expect(registeredPlayerSceneIds).not.toContain('weapon.unlocked');
  });
});
