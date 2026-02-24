import { WebAudioFxService } from './audio';
import { FxEngine, type FxEngineConfig } from './engine';
import { PixiFxRenderer } from './pixi-renderer';
import { installRatingoDefaultPreset } from './presets/ratingo-default';
import { createSceneRegistry } from './scenes/registry';
import type { FxPreset } from './types';

export interface CreateWebFxEngineConfig extends FxEngineConfig {
  preset?: FxPreset;
}

export function createWebFxEngine(
  host: HTMLElement,
  config: CreateWebFxEngineConfig = {},
): FxEngine {
  const { preset = 'ratingo-default', ...engineConfig } = config;
  const renderer = new PixiFxRenderer(host);
  const audio = new WebAudioFxService();
  const sceneRegistry = engineConfig.sceneRegistry ?? createSceneRegistry();
  const engine = new FxEngine(renderer, audio, { ...engineConfig, sceneRegistry });

  if (preset === 'ratingo-default') {
    installRatingoDefaultPreset(engine);
  }

  return engine;
}
