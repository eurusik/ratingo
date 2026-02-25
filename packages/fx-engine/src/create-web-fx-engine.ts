import { WebAudioFxService } from './audio';
import { FxEngine, type FxEngineConfig } from './engine';
import { PixiFxRenderer } from './pixi-renderer';
import { installRatingoDefaultPreset } from './presets/ratingo-default';
import { createSceneRegistry } from './scenes/registry';
import type { FxPreset, FxRegisteredIconSource } from './types';

export interface CreateWebFxEngineConfig extends FxEngineConfig {
  preset?: FxPreset;
  icons?: Record<string, FxRegisteredIconSource>;
}

export function createWebFxEngine(
  host: HTMLElement,
  config: CreateWebFxEngineConfig = {},
): FxEngine {
  const { preset = 'ratingo-default', icons, ...engineConfig } = config;
  const renderer = new PixiFxRenderer(host);
  const audio = new WebAudioFxService();
  const sceneRegistry = engineConfig.sceneRegistry ?? createSceneRegistry();
  const engine = new FxEngine(renderer, audio, { ...engineConfig, sceneRegistry });

  if (preset === 'ratingo-default') {
    installRatingoDefaultPreset(engine);
  }
  if (icons) {
    engine.registerIcons(icons);
  }

  return engine;
}
