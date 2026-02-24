import { describe, expect, it, jest } from '@jest/globals';
import { FxEngine } from '../src/engine';
import type { FxAudioService, FxEvent, FxRenderer } from '../src/types';

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('FxEngine scene registration', () => {
  it('drops events when no scene is registered', async () => {
    const renderer: FxRenderer = {
      playAchievement: jest.fn(async () => undefined),
      dispose: jest.fn(),
    };
    const audio: FxAudioService = {
      unlock: jest.fn(),
      playSting: jest.fn(() => 500),
      dispose: jest.fn(),
    };
    const engine = new FxEngine(renderer, audio, {
      mode: 'epic',
      safeMoment: true,
      reducedMotion: false,
    });

    engine.showAchievement({ title: 'No Scene' });
    await nextTick();

    expect(audio.playSting).not.toHaveBeenCalled();
    expect(renderer.playAchievement).not.toHaveBeenCalled();
  });

  it('delegates scene player registration to renderer when supported', () => {
    const registerScenePlayer = jest.fn();
    const renderer: FxRenderer = {
      playAchievement: jest.fn(async () => undefined),
      registerScenePlayer: registerScenePlayer as FxRenderer['registerScenePlayer'],
      dispose: jest.fn(),
    };
    const audio: FxAudioService = {
      unlock: jest.fn(),
      playSting: jest.fn(() => 500),
      dispose: jest.fn(),
    };
    const engine = new FxEngine(renderer, audio);
    const player = jest.fn(async () => undefined);

    engine.registerScenePlayer('custom.special', player);

    expect(registerScenePlayer).toHaveBeenCalledTimes(1);
    expect(registerScenePlayer).toHaveBeenCalledWith('custom.special', player, undefined);
  });

  it('registers manifest scene and forwards schema to renderer', async () => {
    const registerScenePlayer = jest.fn();
    const renderer: FxRenderer = {
      playAchievement: jest.fn(async () => undefined),
      registerScenePlayer: registerScenePlayer as FxRenderer['registerScenePlayer'],
      dispose: jest.fn(),
    };
    const audio: FxAudioService = {
      unlock: jest.fn(),
      playSting: jest.fn(() => 420),
      dispose: jest.fn(),
    };
    const engine = new FxEngine(renderer, audio, {
      mode: 'epic',
      safeMoment: true,
      reducedMotion: false,
    });
    const schema = (payload: FxEvent): payload is FxEvent =>
      typeof payload.title === 'string' && payload.title.startsWith('MANIFEST ');
    const player = jest.fn(async () => undefined);

    engine.registerManifest({
      id: 'custom.manifest',
      priority: 100,
      supports: () => true,
      schema,
      player,
      create: (event, rarity) => ({
        sceneId: 'custom.manifest',
        rarity,
        payload: {
          ...event,
          title: `MANIFEST ${event.title}`,
          rarity,
        },
      }),
    });

    expect(registerScenePlayer).toHaveBeenCalledWith('custom.manifest', player, schema);

    engine.showAchievement({ title: 'Flow' });
    await nextTick();

    expect(audio.playSting).toHaveBeenCalledWith('common', 'epic');
    expect(renderer.playAchievement).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'MANIFEST Flow',
      }),
      expect.objectContaining({
        durationMs: 420,
      }),
    );
  });

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
