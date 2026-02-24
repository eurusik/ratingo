import { describe, expect, it, jest } from '@jest/globals';
import { FxEngine } from '../src/engine';
import type { FxAudioService, FxRenderer } from '../src/types';

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('FxEngine scene registration', () => {
  it('uses registered scene definition during playback', async () => {
    const renderer: FxRenderer = {
      playAchievement: jest.fn(async () => undefined),
      dispose: jest.fn(),
    };
    const audio: FxAudioService = {
      unlock: jest.fn(),
      playSting: jest.fn(() => 777),
      dispose: jest.fn(),
    };
    const engine = new FxEngine(renderer, audio, {
      mode: 'epic',
      safeMoment: true,
      reducedMotion: false,
    });

    engine.registerScene({
      id: 'custom.special',
      priority: 50,
      supports: () => true,
      create: (event, rarity) => ({
        sceneId: 'custom.special',
        rarity,
        payload: {
          ...event,
          title: `CUSTOM ${event.title}`,
          rarity,
        },
      }),
    });

    engine.showAchievement({ title: 'Unlocked' });
    await nextTick();

    expect(audio.playSting).toHaveBeenCalledWith('common', 'epic');
    expect(renderer.playAchievement).toHaveBeenCalledTimes(1);
    expect(renderer.playAchievement).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'CUSTOM Unlocked',
      }),
      expect.objectContaining({
        mode: 'epic',
        durationMs: 777,
      }),
    );
  });
});
