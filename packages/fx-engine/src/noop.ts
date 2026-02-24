import type {
  FxAudioService,
  FxEvent,
  FxMode,
  FxPayloadSchema,
  FxRarity,
  FxRenderer,
  FxRenderOptions,
  FxScenePlayer,
} from './types';

export const noopRenderer: FxRenderer = {
  async playAchievement(_event: FxEvent, _options: FxRenderOptions): Promise<void> {},
  registerScenePlayer<TPayload extends FxEvent = FxEvent>(
    _sceneId: string,
    _player: FxScenePlayer<TPayload>,
    _schema?: FxPayloadSchema<TPayload>,
  ): void {},
  dispose() {},
};

export const noopAudio: FxAudioService = {
  unlock() {},
  playSting(_rarity: FxRarity, _mode: FxMode) {
    return 0;
  },
  dispose() {},
};
