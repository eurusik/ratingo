import type {
  FxAudioService,
  FxEvent,
  FxMode,
  FxPayloadSchema,
  FxRarity,
  FxRegisteredIconSource,
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
  registerIcon(_key: string, _source: FxRegisteredIconSource): void {},
  registerIcons(_icons: Record<string, FxRegisteredIconSource>): void {},
  dispose() {},
};

export const noopAudio: FxAudioService = {
  unlock() {},
  playSting(_rarity: FxRarity, _mode: FxMode, _event?: FxEvent) {
    return 0;
  },
  dispose() {},
};
