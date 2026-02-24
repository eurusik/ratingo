import { describe, expect, it, jest } from '@jest/globals';
import type { FxRenderOptions, FxRenderer } from '../src/types';
import { renderScene } from '../src/scenes/runtime';

describe('renderScene', () => {
  it('routes achievement scene to playAchievement', async () => {
    const playAchievementMock = jest.fn<FxRenderer['playAchievement']>(async () => undefined);
    const renderer: FxRenderer = {
      playAchievement: playAchievementMock,
      dispose: jest.fn(),
    };
    const options: FxRenderOptions = {
      mode: 'epic',
      reducedMotion: false,
      durationMs: 1500,
    };

    await renderScene(
      renderer,
      {
        sceneId: 'achievement.unlocked',
        rarity: 'rare',
        payload: {
          title: 'Unlocked',
          rarity: 'rare',
        },
      },
      options,
    );

    expect(playAchievementMock).toHaveBeenCalledTimes(1);
    expect(playAchievementMock).toHaveBeenCalledWith(
      {
        title: 'Unlocked',
        rarity: 'rare',
      },
      options,
    );
  });

  it('falls back to renderer for custom scene ids', async () => {
    const playAchievementMock = jest.fn<FxRenderer['playAchievement']>(async () => undefined);
    const renderer: FxRenderer = {
      playAchievement: playAchievementMock,
      dispose: jest.fn(),
    };

    await renderScene(
      renderer,
      {
        sceneId: 'custom.special',
        rarity: 'legendary',
        payload: {
          title: 'Custom Scene',
          rarity: 'legendary',
        },
      },
      {
        mode: 'epic',
        reducedMotion: false,
      },
    );

    expect(playAchievementMock).toHaveBeenCalledTimes(1);
    expect(playAchievementMock).toHaveBeenCalledWith(
      {
        title: 'Custom Scene',
        rarity: 'legendary',
      },
      {
        mode: 'epic',
        reducedMotion: false,
      },
    );
  });
});
