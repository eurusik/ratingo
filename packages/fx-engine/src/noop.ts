import type { FxAudioService, FxMode, FxRarity, FxRenderer, AchievementFxEvent, FxRenderOptions } from './types';

export const noopRenderer: FxRenderer = {
  async playAchievement(_event: AchievementFxEvent, _options: FxRenderOptions): Promise<void> {},
  dispose() {},
};

export const noopAudio: FxAudioService = {
  unlock() {},
  playSting(_rarity: FxRarity, _mode: FxMode) {},
  dispose() {},
};
